import { createClient } from '@supabase/supabase-js';

// Supabase initialization
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_PRIVATE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Fallback value for global success count
let globalSuccessCount = 0;

// Fetch the count from Supabase every time
export const getGlobalSuccessCount = async () => {
  try {
    const { data, error } = await supabase
      .from('global_counts')
      .select('count')
      .eq('id', 1)
      .single();

    if (error) {
      console.error('Error fetching global success count:', error.message);
      return globalSuccessCount; // Return the last known value
    }

    globalSuccessCount = data ? data.count : 0; // Update the local variable
    return globalSuccessCount;
  } catch (err) {
    console.error('Unexpected error fetching global success count:', err.message);
    return globalSuccessCount; // Return the last known value
  }
};

// Update the count in Supabase
export const setGlobalSuccessCount = async (value) => {
  globalSuccessCount = value;

  try {
    const { error } = await supabase
      .from('global_counts')
      .upsert({ id: 1, count: globalSuccessCount });

    if (error) {
      console.error('Error updating global success count:', error.message);
    }
  } catch (err) {
    console.error('Unexpected error updating global success count:', err.message);
  }
};
