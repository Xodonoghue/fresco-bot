export function getEnvVar(name: string): string {
    const value = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!value) {
      throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
  }