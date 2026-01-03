import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL || 'https://rbdwqdrqnmshebnhpecr.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || 'sb_secret_c9OwZ8hN9plOLyA7I6cB8w_j135Pgyo';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Webhook endpoint for Facebook Messenger
app.post('/api/webhook', async (req, res) => {
  try {
    const { body } = req;
    
    // Verify webhook (Facebook requires this for initial setup)
    if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === process.env.FB_VERIFY_TOKEN) {
      return res.status(200).send(req.query['hub.challenge']);
    }
    
    // Handle incoming messages
    if (body.object === 'page') {
      for (const entry of body.entry) {
        const pageId = entry.id;
        
        for (const messagingEvent of entry.messaging) {
          const senderId = messagingEvent.sender.id;
          const message = messagingEvent.message;
          
          if (message && message.text) {
            // Save message to database
            const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const conversationId = `conv-${pageId}-${senderId}`;
            
            // Check if conversation exists
            const { data: existingConv } = await supabase
              .from('conversations')
              .select('*')
              .eq('id', conversationId)
              .single();
            
            if (!existingConv) {
              // Create new conversation
              const newConversation = {
                id: conversationId,
                pageId: pageId,
                customerId: senderId,
                customerName: `User ${senderId.substring(0, 8)}`,
                customerAvatar: `https://picsum.photos/seed/${senderId}/200`,
                lastMessage: message.text,
                lastTimestamp: new Date().toISOString(),
                status: 'OPEN',
                assignedAgentId: null,
                unreadCount: 1
              };
              
              await supabase
                .from('conversations')
                .upsert(newConversation);
            } else {
              // Update existing conversation
              await supabase
                .from('conversations')
                .update({
                  lastMessage: message.text,
                  lastTimestamp: new Date().toISOString(),
                  unreadCount: existingConv.unreadCount + 1
                })
                .eq('id', conversationId);
            }
            
            // Save the message
            const newMessage = {
              id: messageId,
              conversationId: conversationId,
              senderId: senderId,
              senderName: `User ${senderId.substring(0, 8)}`,
              text: message.text,
              timestamp: new Date().toISOString(),
              isIncoming: true,
              isRead: false
            };
            
            await supabase
              .from('messages')
              .insert(newMessage);
          }
        }
      }
      
      return res.status(200).send('EVENT_RECEIVED');
    }
    
    res.status(404).send('Not found');
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).send('Internal server error');
  }
});

// API endpoint to get conversations
app.get('/api/conversations', async (req, res) => {
  try {
    const { pageId } = req.query;
    
    // Try with lastTimestamp ordering
    let query = supabase
      .from('conversations')
      .select('*')
      .order('lastTimestamp', { ascending: false });
    
    if (pageId) {
      query = query.eq('pageId', pageId);
    }
    
    const { data, error } = await query;
    
    if (error) {
      // If column doesn't exist error, try without ordering
      if (error.code === '42703') {
        console.log('lastTimestamp column not found, trying without ordering');
        let simpleQuery = supabase.from('conversations').select('*');
        
        if (pageId) {
          simpleQuery = simpleQuery.eq('pageId', pageId);
        }
        
        const { data: simpleData, error: simpleError } = await simpleQuery;
        
        if (simpleError) {
          // If table doesn't exist, return empty array
          if (simpleError.code === '42P01') {
            console.log('conversations table does not exist, returning empty array');
            return res.json([]);
          }
          throw simpleError;
        }
        
        return res.json(simpleData || []);
      }
      
      // If table doesn't exist, return empty array
      if (error.code === '42P01') {
        console.log('conversations table does not exist, returning empty array');
        return res.json([]);
      }
      
      throw error;
    }
    
    res.json(data || []);
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// API endpoint to get messages for a conversation
app.get('/api/conversations/:conversationId/messages', async (req, res) => {
  try {
    const { conversationId } = req.params;
    
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversationId', conversationId);
    
    if (error) {
      // If messages table doesn't exist, return empty array
      if (error.code === '42P01') {
        console.log('messages table does not exist, returning empty array');
        return res.json([]);
      }
      throw error;
    }
    
    // Sort by timestamp if data exists and has timestamp field
    if (data && data.length > 0 && data[0].timestamp) {
      data.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    }
    
    res.json(data || []);
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// API endpoint to send a message
app.post('/api/messages', async (req, res) => {
  try {
    const { conversationId, senderId, senderName, text, isIncoming = false } = req.body;
    
    if (!conversationId || !text) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const newMessage = {
      id: messageId,
      conversationId: conversationId,
      senderId: senderId || 'agent',
      senderName: senderName || 'Agent',
      text,
      timestamp: new Date().toISOString(),
      isIncoming: isIncoming,
      isRead: !isIncoming
    };
    
    const { data, error } = await supabase
      .from('messages')
      .insert(newMessage)
      .select()
      .single();
    
    if (error) {
      // If messages table doesn't exist, simulate success
      if (error.code === '42P01') {
        console.log('messages table does not exist, simulating message send');
        return res.json({
          ...newMessage,
          simulated: true,
          message: 'Table does not exist, message simulated'
        });
      }
      throw error;
    }
    
    // Try to update conversation last message
    try {
      await supabase
        .from('conversations')
        .update({
          lastMessage: text,
          lastTimestamp: new Date().toISOString()
        })
        .eq('id', conversationId);
    } catch (updateError) {
      console.log('Could not update conversation:', updateError.message);
    }
    
    res.json(data);
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// API endpoint to update conversation status
app.put('/api/conversations/:conversationId', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const updates = req.body;
    
    const { data, error } = await supabase
      .from('conversations')
      .update(updates)
      .eq('id', conversationId)
      .select()
      .single();
    
    if (error) {
      // If conversations table doesn't exist, simulate success
      if (error.code === '42P01') {
        console.log('conversations table does not exist, simulating update');
        return res.json({
          id: conversationId,
          ...updates,
          simulated: true,
          message: 'Table does not exist, update simulated'
        });
      }
      throw error;
    }
    
    res.json(data);
  } catch (error) {
    console.error('Update conversation error:', error);
    res.status(500).json({ error: 'Failed to update conversation' });
  }
});

// API endpoint to get dashboard statistics
app.get('/api/dashboard/stats', async (req, res) => {
  try {
    // Return mock statistics since tables might not exist
    const mockStats = {
      openChats: 5,
      avgResponseTime: "0m 30s",
      resolvedToday: 12,
      csat: "98%",
      chartData: [
        { name: "Mon", conversations: 8 },
        { name: "Tue", conversations: 12 },
        { name: "Wed", conversations: 10 },
        { name: "Thu", conversations: 15 },
        { name: "Fri", conversations: 18 },
        { name: "Sat", conversations: 9 },
        { name: "Sun", conversations: 6 }
      ],
      simulated: true,
      message: "Using mock data - database tables may not be initialized"
    };
    
    res.json(mockStats);
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Supabase URL: ${supabaseUrl}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  console.log(`Note: If database tables are not initialized, the API will return mock/simulated data`);
});

export default app;
// --- Add this at the bottom of server.js ---
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://0.0.0.0:${PORT}/api/health`);
});
