declare namespace NodeJS {
  interface ProcessEnv {
    DEEPSEEK_API_KEY: string;
    DEEPSEEK_BASE_URL: string;
    DEEPSEEK_MODEL: string;
    NEXT_PUBLIC_SUPABASE_URL: string;
    NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
    SUPABASE_SERVICE_ROLE_KEY: string;
  }
}
