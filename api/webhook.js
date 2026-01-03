import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL || 'https://fiuodbhgvmylvbanbfve.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || 'sb_secret_x33xGa8YmioWvfyvDtWNXA_fT_8VL9V';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const VERIFY_TOKEN = "my_secret_123";

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle OPTIONS request for CORS
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method === "GET") {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("WEBHOOK_VERIFIED");
      res.status(200).send(challenge);
    } else {
      res.status(403).send("Verification failed");
    }
  } else if (req.method === "POST") {
    try {
      const { body } = req;
      console.log("Webhook event received:", JSON.stringify(body, null, 2));
      
      // Handle incoming messages from Facebook
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
                  page_id: pageId,
                  customer_id: senderId,
                  customer_name: `User ${senderId.substring(0, 8)}`,
                  customer_avatar: `https://picsum.photos/seed/${senderId}/200`,
                  last_message: message.text,
                  last_timestamp: new Date().toISOString(),
                  status: 'OPEN',
                  assigned_agent_id: null,
                  unread_count: 1
                };
                
                await supabase
                  .from('conversations')
                  .upsert(newConversation);
              } else {
                // Update existing conversation
                await supabase
                  .from('conversations')
                  .update({
                    last_message: message.text,
                    last_timestamp: new Date().toISOString(),
                    unread_count: existingConv.unread_count + 1
                  })
                  .eq('id', conversationId);
              }
              
              // Save the message
              const newMessage = {
                id: messageId,
                conversation_id: conversationId,
                sender_id: senderId,
                sender_name: `User ${senderId.substring(0, 8)}`,
                text: message.text,
                timestamp: new Date().toISOString(),
                is_incoming: true,
                is_read: false
              };
              
              await supabase
                .from('messages')
                .insert(newMessage);
                
              console.log(`Message saved: ${message.text}`);
            }
          }
        }
        
        res.status(200).send("EVENT_RECEIVED");
      } else {
        res.status(200).send("EVENT_RECEIVED");
      }
    } catch (error) {
      console.error("Webhook processing error:", error);
      res.status(500).send("Internal server error");
    }
  } else {
    res.status(404).send("Not Found");
  }
}