-- Fix the trigger to bypass RLS completely
-- Run this in Supabase SQL Editor

-- Drop the existing INSERT policy if it exists
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON profiles;

-- Recreate the trigger function with proper permissions
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
EXCEPTION
  WHEN others THEN
    RAISE LOG 'Error in handle_new_user: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Make sure the trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Create a policy that allows the trigger to insert
-- This policy allows INSERT when the ID matches the authenticated user
-- OR when there's no auth.uid() (which happens during the trigger)
CREATE POLICY "Allow profile creation during signup" ON profiles
  FOR INSERT 
  WITH CHECK (
    auth.uid() = id OR auth.uid() IS NULL
  );
