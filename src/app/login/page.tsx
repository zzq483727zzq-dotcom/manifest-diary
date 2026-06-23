import { AuthForm } from '@/components/AuthForm';

export default function LoginPage() {
  return (
    <main
      className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden"
      data-theme="night"
    >
      {/* 顶部台灯光晕：左上一缕暖橘 */}
      <div
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          top: '-12%',
          left: '-8%',
          width: '52%',
          height: '52%',
          background:
            'radial-gradient(circle, rgba(245,166,35,0.16) 0%, rgba(245,166,35,0.04) 38%, transparent 68%)',
          filter: 'blur(8px)',
        }}
      />

      {/* 右下：冷紫余晖 */}
      <div
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          bottom: '-15%',
          right: '-10%',
          width: '48%',
          height: '48%',
          background:
            'radial-gradient(circle, rgba(120,90,200,0.10) 0%, transparent 60%)',
          filter: 'blur(10px)',
        }}
      />

      {/* 稀疏星点：金色 + 白色微光，散落几颗 */}
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <span
          className="absolute breathe"
          style={{
            top: '14%',
            right: '22%',
            width: '3px',
            height: '3px',
            borderRadius: '50%',
            background: '#fff',
            boxShadow: '0 0 6px rgba(255,255,255,0.85)',
            animationDelay: '0.2s',
          }}
        />
        <span
          className="absolute breathe"
          style={{
            top: '28%',
            right: '12%',
            width: '2px',
            height: '2px',
            borderRadius: '50%',
            background: 'var(--gold-bright)',
            boxShadow: '0 0 5px rgba(245,215,122,0.75)',
            animationDelay: '0.8s',
          }}
        />
        <span
          className="absolute breathe"
          style={{
            top: '60%',
            left: '12%',
            width: '2px',
            height: '2px',
            borderRadius: '50%',
            background: '#fff',
            boxShadow: '0 0 5px rgba(255,255,255,0.65)',
            animationDelay: '1.5s',
          }}
        />
        <span
          className="absolute breathe"
          style={{
            top: '78%',
            right: '18%',
            width: '2px',
            height: '2px',
            borderRadius: '50%',
            background: 'var(--gold-solid)',
            boxShadow: '0 0 4px rgba(212,175,55,0.6)',
            animationDelay: '2.4s',
          }}
        />
        <span
          className="absolute breathe"
          style={{
            top: '42%',
            left: '6%',
            width: '1.5px',
            height: '1.5px',
            borderRadius: '50%',
            background: '#fff',
            boxShadow: '0 0 3px rgba(255,255,255,0.5)',
            animationDelay: '3s',
          }}
        />
      </div>

      {/* AuthForm 居中 */}
      <div className="relative z-10 w-full">
        <AuthForm />
      </div>
    </main>
  );
}
