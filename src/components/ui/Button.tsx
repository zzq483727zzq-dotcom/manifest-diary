'use client';

import { forwardRef } from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'ghost' | 'soft';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps
  extends Omit<HTMLMotionProps<'button'>, 'children'> {
  variant?: Variant;
  size?: Size;
  /** 自定义内部内容；也支持纯字符串 */
  children?: React.ReactNode;
}

const sizeMap: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-sm rounded-lg',
  md: 'px-5 py-2.5 text-sm rounded-xl',
  lg: 'px-7 py-3.5 text-base rounded-xl',
};

/**
 * 通用仪式感按钮
 * - primary  玫瑰金渐变填充 + shimmer 流光 + hover 光晕加强
 * - ghost    透明描边
 * - soft     半透明背景
 * 交互：whileHover scale 1.03 / whileTap scale 0.96，disabled 降透明度。
 * 用 CSS 变量取色，不硬编码 hex。
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { variant = 'primary', size = 'md', className, disabled, children, ...rest },
    ref,
  ) {
    const base =
      'relative inline-flex items-center justify-center font-medium ' +
      'select-none transition-[box-shadow,opacity,background-color] duration-200 ' +
      'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-rose)] ' +
      'ceremonial-tap overflow-hidden';

    const variantClass: Record<Variant, string> = {
      primary: 'text-white shimmer',
      ghost: 'border',
      soft: '',
    };

    const variantStyle: Record<Variant, React.CSSProperties> = {
      primary: {
        backgroundImage: 'var(--accent-rose-gold)',
        boxShadow: disabled
          ? 'none'
          : '0 0 16px rgba(244, 114, 182, 0.25)',
      },
      ghost: {
        borderColor: 'var(--border)',
        color: 'var(--text-primary)',
        backgroundColor: 'transparent',
      },
      soft: {
        backgroundColor: 'var(--bg-card-glow)',
        color: 'var(--text-primary)',
      },
    };

    return (
      <motion.button
        ref={ref}
        whileHover={disabled ? undefined : { scale: 1.03 }}
        whileTap={disabled ? undefined : { scale: 0.96 }}
        className={cn(
          base,
          sizeMap[size],
          variantClass[variant],
          disabled && 'opacity-50 cursor-not-allowed pointer-events-none',
          className,
        )}
        style={{ ...variantStyle[variant] }}
        disabled={disabled}
        // hover 时玫瑰金光晕加强 —— 通过 CSS transition + className 组合
        onMouseEnter={(e) => {
          if (disabled) return;
          if (variant === 'primary') {
            e.currentTarget.style.boxShadow =
              '0 0 28px rgba(244, 114, 182, 0.55), 0 0 56px rgba(251, 191, 36, 0.25)';
          } else if (variant === 'ghost') {
            e.currentTarget.style.borderColor = 'var(--accent-rose)';
            e.currentTarget.style.boxShadow = '0 0 18px rgba(244, 114, 182, 0.35)';
          } else if (variant === 'soft') {
            e.currentTarget.style.boxShadow = '0 0 20px rgba(244, 114, 182, 0.25)';
          }
          rest.onMouseEnter?.(e);
        }}
        onMouseLeave={(e) => {
          if (disabled) return;
          if (variant === 'primary') {
            e.currentTarget.style.boxShadow = '0 0 16px rgba(244, 114, 182, 0.25)';
          } else {
            e.currentTarget.style.boxShadow = '';
            if (variant === 'ghost') {
              e.currentTarget.style.borderColor = 'var(--border)';
            }
          }
          rest.onMouseLeave?.(e);
        }}
        {...rest}
      >
        {children}
      </motion.button>
    );
  },
);
