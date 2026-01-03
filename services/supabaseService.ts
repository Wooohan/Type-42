import { supabase, TABLES, CHANNELS, isSupabaseConfigured } from './supabaseConfig';
import { User, FacebookPage, Conversation, Message, ApprovedLink, ApprovedMedia } from '../types';

export class SupabaseService {
  private static instance: SupabaseService;
  private realtimeSubscriptions: Map<string, any> = new Map();
  
  private constructor() {}
  
  public static getInstance(): SupabaseService {
    if (!SupabaseService.instance) {
      SupabaseService.instance = new SupabaseService();
    }
    return SupabaseService.instance;
  }
  
  // Initialize Supabase connection
  async init(): Promise<void> {
    if (!isSupabaseConfigured()) {
      console.warn('Supabase is not properly configured. Using default URL.');
    }
    
    try {
      // Test connection
      const { data, error } = await supabase.from(TABLES.USERS).select('count').limit(1);
      if (error) {
        console.error('Supabase connection test failed:', error);
        throw error;
      }
      console.log('Supabase connection established successfully');
    } catch (error) {
      console.error('Failed to initialize Supabase:', error);
      throw error;
    }
  }
  
  // Generic CRUD operations
  async getAll<T>(table: string): Promise<T[]> {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as T[];
    } catch (error) {
      console.error(`Error fetching all from ${table}:`, error);
      return [];
    }
  }
  
  async getById<T>(table: string, id: string): Promise<T | null> {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data as T;
    } catch (error) {
      console.error(`Error fetching from ${table} with id ${id}:`, error);
      return null;
    }
  }
  
  async put<T>(table: string, item: T & { id: string }): Promise<void> {
    try {
      const { error } = await supabase
        .from(table)
        .upsert(item, { onConflict: 'id' });
      
      if (error) throw error;
    } catch (error) {
      console.error(`Error upserting to ${table}:`, error);
      throw error;
    }
  }
  
  async delete(table: string, id: string): Promise<void> {
    try {
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    } catch (error) {
      console.error(`Error deleting from ${table} with id ${id}:`, error);
      throw error;
    }
  }
  
  async clearStore(table: string): Promise<void> {
    try {
      const { error } = await supabase
        .from(table)
        .delete()
        .neq('id', '0'); // Delete all records (id will never be '0')
      
      if (error) throw error;
    } catch (error) {
      console.error(`Error clearing table ${table}:`, error);
      throw error;
    }
  }
  
  // User-specific operations
  async getUsers(): Promise<User[]> {
    return this.getAll<User>(TABLES.USERS);
  }
  
  async getUserById(id: string): Promise<User | null> {
    return this.getById<User>(TABLES.USERS, id);
  }
  
  async getUserByEmail(email: string): Promise<User | null> {
    try {
      const { data, error } = await supabase
        .from(TABLES.USERS)
        .select('*')
        .eq('email', email)
        .single();
      
      if (error) throw error;
      return data as User;
    } catch (error) {
      console.error(`Error fetching user by email ${email}:`, error);
      return null;
    }
  }
  
  async saveUser(user: User): Promise<void> {
    await this.put<User>(TABLES.USERS, user);
  }
  
  // Page-specific operations
  async getPages(): Promise<FacebookPage[]> {
    return this.getAll<FacebookPage>(TABLES.PAGES);
  }
  
  async savePage(page: FacebookPage): Promise<void> {
    await this.put<FacebookPage>(TABLES.PAGES, page);
  }
  
  // Conversation-specific operations
  async getConversations(): Promise<Conversation[]> {
    return this.getAll<Conversation>(TABLES.CONVERSATIONS);
  }
  
  async getConversationsByPageId(pageId: string): Promise<Conversation[]> {
    try {
      const { data, error } = await supabase
        .from(TABLES.CONVERSATIONS)
        .select('*')
        .eq('page_id', pageId)
        .order('last_timestamp', { ascending: false });
      
      if (error) throw error;
      return data as Conversation[];
    } catch (error) {
      console.error(`Error fetching conversations for page ${pageId}:`, error);
      return [];
    }
  }
  
  async saveConversation(conversation: Conversation): Promise<void> {
    await this.put<Conversation>(TABLES.CONVERSATIONS, conversation);
  }
  
  // Message-specific operations
  async getMessages(): Promise<Message[]> {
    return this.getAll<Message>(TABLES.MESSAGES);
  }
  
  async getMessagesByConversationId(conversationId: string): Promise<Message[]> {
    try {
      const { data, error } = await supabase
        .from(TABLES.MESSAGES)
        .select('*')
        .eq('conversation_id', conversationId)
        .order('timestamp', { ascending: true });
      
      if (error) throw error;
      return data as Message[];
    } catch (error) {
      console.error(`Error fetching messages for conversation ${conversationId}:`, error);
      return [];
    }
  }
  
  async saveMessage(message: Message): Promise<void> {
    await this.put<Message>(TABLES.MESSAGES, message);
  }
  
  async saveMessages(messages: Message[]): Promise<void> {
    try {
      const { error } = await supabase
        .from(TABLES.MESSAGES)
        .upsert(messages, { onConflict: 'id' });
      
      if (error) throw error;
    } catch (error) {
      console.error('Error saving multiple messages:', error);
      throw error;
    }
  }
  
  // Approved links operations
  async getApprovedLinks(): Promise<ApprovedLink[]> {
    return this.getAll<ApprovedLink>(TABLES.APPROVED_LINKS);
  }
  
  async saveApprovedLink(link: ApprovedLink): Promise<void> {
    await this.put<ApprovedLink>(TABLES.APPROVED_LINKS, link);
  }
  
  // Approved media operations
  async getApprovedMedia(): Promise<ApprovedMedia[]> {
    return this.getAll<ApprovedMedia>(TABLES.APPROVED_MEDIA);
  }
  
  async saveApprovedMedia(media: ApprovedMedia): Promise<void> {
    await this.put<ApprovedMedia>(TABLES.APPROVED_MEDIA, media);
  }
  
  // Real-time subscriptions
  subscribeToConversations(callback: (payload: any) => void): () => void {
    const channel = supabase
      .channel(CHANNELS.CONVERSATIONS)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: TABLES.CONVERSATIONS
        },
        callback
      )
      .subscribe();
    
    this.realtimeSubscriptions.set(CHANNELS.CONVERSATIONS, channel);
    
    return () => {
      channel.unsubscribe();
      this.realtimeSubscriptions.delete(CHANNELS.CONVERSATIONS);
    };
  }
  
  subscribeToMessages(callback: (payload: any) => void): () => void {
    const channel = supabase
      .channel(CHANNELS.MESSAGES)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: TABLES.MESSAGES
        },
        callback
      )
      .subscribe();
    
    this.realtimeSubscriptions.set(CHANNELS.MESSAGES, channel);
    
    return () => {
      channel.unsubscribe();
      this.realtimeSubscriptions.delete(CHANNELS.MESSAGES);
    };
  }
  
  subscribeToPresence(callback: (state: any) => void): () => void {
    const channel = supabase
      .channel(CHANNELS.PRESENCE)
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        callback(state);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ online_at: new Date().toISOString() });
        }
      });
    
    this.realtimeSubscriptions.set(CHANNELS.PRESENCE, channel);
    
    return () => {
      channel.unsubscribe();
      this.realtimeSubscriptions.delete(CHANNELS.PRESENCE);
    };
  }
  
  // Cleanup all subscriptions
  cleanupSubscriptions(): void {
    this.realtimeSubscriptions.forEach((channel, key) => {
      channel.unsubscribe();
      console.log(`Unsubscribed from ${key}`);
    });
    this.realtimeSubscriptions.clear();
  }
  
  // Authentication methods
  async signIn(email: string, password: string): Promise<{ user: any; session: any } | null> {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Sign in error:', error);
      return null;
    }
  }
  
  async signOut(): Promise<void> {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  }
  
  async getCurrentSession(): Promise<any> {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;
      return session;
    } catch (error) {
      console.error('Get session error:', error);
      return null;
    }
  }
  
  async getCurrentUser(): Promise<any> {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) throw error;
      return user;
    } catch (error) {
      console.error('Get user error:', error);
      return null;
    }
  }
}

export const supabaseService = SupabaseService.getInstance();