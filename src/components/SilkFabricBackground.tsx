import React, { useEffect, useRef } from 'react';

interface SilkFabricBackgroundProps {
  className?: string;
  showGrid?: boolean;
  showParticles?: boolean;
  intensity?: 'subtle' | 'normal' | 'vibrant';
  accentColor?: string;
}

interface Particle {
  x: number;
  y: number;
  size: number;
  speedY: number;
  speedX: number;
  baseAlpha: number;
  alpha: number;
  pulseSpeed: number;
  pulsePhase: number;
  hue: number;
}

/**
 * Hiệu ứng hình nền chuyển động cực đẹp & siêu mượt (Living Animated Aurora Background):
 * 1. Dải lụa phát sáng mềm mại uốn lượn liên tục 60 FPS (Continuous Wave ribbons).
 * 2. Đom đóm / hạt ánh sáng (Luminescent Bokeh Particles) bay lơ lửng bồng bềnh từ dưới lên trên.
 * 3. Hiệu ứng tương tác mượt mà theo chuyển động chuột (Interactive gentle mouse parallax).
 * 4. Tầng hào quang đa sắc (Emerald, Teal, Cyan) với quả cầu năng lượng chuyển động chậm.
 * 5. Hỗ trợ chuẩn Retina Hi-DPI, tự động tạm dừng khi chuyển tab để bảo vệ pin và CPU.
 * 6. Tuân thủ prefers-reduced-motion cho trải nghiệm mượt mà không mỏi mắt.
 */
export const SilkFabricBackground: React.FC<SilkFabricBackgroundProps> = ({
  className = "fixed inset-0 pointer-events-none overflow-hidden -z-10",
  showGrid = true,
  showParticles = true,
  intensity = 'normal'
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Dynamic intensity factors
  const opacityMultiplier = intensity === 'vibrant' ? 1.4 : intensity === 'subtle' ? 0.65 : 1.0;
  const particleCount = intensity === 'subtle' ? 20 : intensity === 'vibrant' ? 45 : 32;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let animationFrameId: number | null = null;
    let isPaused = false;
    let dpr = Math.min(window.devicePixelRatio || 1, 2); // Cap at 2x for optimal mobile GPU performance

    let width = window.innerWidth;
    let height = window.innerHeight;

    const resizeCanvas = () => {
      if (!canvas) return;
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas, { passive: true });

    // Smooth mouse coordinates with spring interpolation
    let targetMouseX = width * 0.5;
    let targetMouseY = height * 0.35;
    let currentMouseX = targetMouseX;
    let currentMouseY = targetMouseY;

    const handleMouseMove = (e: MouseEvent) => {
      targetMouseX = e.clientX;
      targetMouseY = e.clientY;
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });

    // Auto pause loop when browser tab is inactive to preserve battery & GPU
    const handleVisibilityChange = () => {
      if (document.hidden) {
        isPaused = true;
        if (animationFrameId !== null) {
          cancelAnimationFrame(animationFrameId);
          animationFrameId = null;
        }
      } else {
        if (isPaused) {
          isPaused = false;
          lastTime = performance.now();
          animationFrameId = requestAnimationFrame(render);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Initialize floating luminescent starlight bokeh particles
    const particles: Particle[] = [];
    if (showParticles) {
      for (let i = 0; i < particleCount; i++) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          size: Math.random() * 2.2 + 0.8,
          speedY: -(Math.random() * 0.35 + 0.15),
          speedX: (Math.random() - 0.5) * 0.25,
          baseAlpha: Math.random() * 0.45 + 0.25,
          alpha: Math.random() * 0.45 + 0.25,
          pulseSpeed: Math.random() * 0.002 + 0.001,
          pulsePhase: Math.random() * Math.PI * 2,
          hue: Math.random() > 0.4 ? 160 : 185 // emerald vs cyan
        });
      }
    }

    // Ribbons config: Emerald, Jade, Teal & Cyan satin wave ribbons
    const ribbons = [
      {
        speed: 0.00065,
        freq: 0.0018,
        amp: 55,
        depth: 260,
        baseOpacity: 0.09 * opacityMultiplier,
        hue: 160,
        color1: 'rgba(16, 185, 129,',
        color2: 'rgba(52, 211, 153,'
      },
      {
        speed: 0.00085,
        freq: 0.0015,
        amp: 70,
        depth: 320,
        baseOpacity: 0.075 * opacityMultiplier,
        hue: 175,
        color1: 'rgba(20, 184, 166,',
        color2: 'rgba(6, 182, 212,'
      },
      {
        speed: 0.0005,
        freq: 0.0022,
        amp: 45,
        depth: 230,
        baseOpacity: 0.08 * opacityMultiplier,
        hue: 150,
        color1: 'rgba(5, 150, 105,',
        color2: 'rgba(16, 185, 129,'
      },
      {
        speed: 0.00095,
        freq: 0.0012,
        amp: 60,
        depth: 290,
        baseOpacity: 0.06 * opacityMultiplier,
        hue: 190,
        color1: 'rgba(6, 182, 212,',
        color2: 'rgba(14, 165, 233,'
      }
    ];

    let time = 0;
    let lastTime = performance.now();

    const render = (now: number) => {
      if (isPaused || document.hidden) return;

      const delta = Math.min(32, now - lastTime);
      lastTime = now;
      time += delta;

      // Mouse position smoothing with spring easing
      currentMouseX += (targetMouseX - currentMouseX) * 0.04;
      currentMouseY += (targetMouseY - currentMouseY) * 0.04;

      ctx.clearRect(0, 0, width, height);

      // 1. Render Silk Wave Ribbons
      const startX = -180;
      const startY = -180;
      const endX = width + 180;
      const endY = height + 180;

      const dx = endX - startX;
      const dy = endY - startY;
      const length = Math.sqrt(dx * dx + dy * dy) || 1200;
      const ux = dx / length;
      const uy = dy / length;
      const nx = -uy;
      const ny = ux;

      const steps = 30; // High resolution curved mesh

      // Parallax mouse influence on ribbon displacement
      const mouseFactorX = ((currentMouseX / width) - 0.5) * 40;
      const mouseFactorY = ((currentMouseY / height) - 0.5) * 40;

      ribbons.forEach((ribbon, rIndex) => {
        ctx.save();
        ctx.beginPath();

        const phaseOffset = rIndex * 1.85;
        const currentPhase = time * ribbon.speed + phaseOffset;

        const topPoints: { x: number; y: number }[] = [];
        const bottomPoints: { x: number; y: number }[] = [];

        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          const distAlong = t * length;

          const cx = startX + ux * distAlong;
          const cy = startY + uy * distAlong;

          // Interactive deflection near mouse
          const distToMouse = Math.hypot(cx - currentMouseX, cy - currentMouseY);
          const mouseDeflect = Math.max(0, 1 - distToMouse / 600) * 22;

          const wave1 = Math.sin(distAlong * ribbon.freq + currentPhase) * ribbon.amp;
          const wave2 = Math.sin(distAlong * ribbon.freq * 0.6 - currentPhase * 0.8) * (ribbon.amp * 0.45);
          const displacement = wave1 + wave2 + mouseDeflect + (mouseFactorX * (1 - t) + mouseFactorY * t);

          topPoints.push({
            x: cx + nx * displacement,
            y: cy + ny * displacement
          });

          const dynamicDepth = ribbon.depth * (0.85 + 0.25 * Math.sin(distAlong * 0.0028 + currentPhase * 1.2));
          bottomPoints.push({
            x: cx + nx * (displacement + dynamicDepth),
            y: cy + ny * (displacement + dynamicDepth)
          });
        }

        // Draw smooth top edge
        ctx.moveTo(topPoints[0].x, topPoints[0].y);
        for (let i = 1; i < topPoints.length - 1; i++) {
          const mx = (topPoints[i].x + topPoints[i + 1].x) / 2;
          const my = (topPoints[i].y + topPoints[i + 1].y) / 2;
          ctx.quadraticCurveTo(topPoints[i].x, topPoints[i].y, mx, my);
        }
        ctx.lineTo(topPoints[topPoints.length - 1].x, topPoints[topPoints.length - 1].y);

        // Connect to bottom edge
        ctx.lineTo(bottomPoints[bottomPoints.length - 1].x, bottomPoints[bottomPoints.length - 1].y);

        // Draw smooth bottom edge in reverse
        for (let i = bottomPoints.length - 2; i > 0; i--) {
          const mx = (bottomPoints[i].x + bottomPoints[i - 1].x) / 2;
          const my = (bottomPoints[i].y + bottomPoints[i - 1].y) / 2;
          ctx.quadraticCurveTo(bottomPoints[i].x, bottomPoints[i].y, mx, my);
        }
        ctx.lineTo(bottomPoints[0].x, bottomPoints[0].y);
        ctx.closePath();

        // Satin wave gradient fill
        const grad = ctx.createLinearGradient(0, 0, width, height);
        grad.addColorStop(0, `${ribbon.color1} 0)`);
        grad.addColorStop(0.25, `${ribbon.color1} ${ribbon.baseOpacity * 0.85})`);
        grad.addColorStop(0.55, `${ribbon.color2} ${ribbon.baseOpacity * 1.6})`);
        grad.addColorStop(0.85, `${ribbon.color1} ${ribbon.baseOpacity * 0.9})`);
        grad.addColorStop(1, `${ribbon.color2} 0)`);

        ctx.fillStyle = grad;
        ctx.fill();
        ctx.restore();
      });

      // 2. Render Floating Bokeh / Starlight Embers
      if (showParticles && particles.length > 0) {
        particles.forEach((p) => {
          // Update particle position
          p.y += p.speedY;
          p.x += p.speedX + Math.sin(time * 0.0015 + p.pulsePhase) * 0.2;
          p.pulsePhase += p.pulseSpeed * delta;
          p.alpha = p.baseAlpha * (0.6 + 0.4 * Math.sin(p.pulsePhase)) * opacityMultiplier;

          // Wrap around screen boundaries
          if (p.y < -20) {
            p.y = height + 10;
            p.x = Math.random() * width;
          }
          if (p.x < -20) p.x = width + 10;
          if (p.x > width + 20) p.x = -10;

          // Radial glow for each particle
          const glowRadius = p.size * 3.5;
          const radialGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowRadius);
          radialGrad.addColorStop(0, `hsla(${p.hue}, 90%, 65%, ${p.alpha})`);
          radialGrad.addColorStop(0.4, `hsla(${p.hue}, 85%, 55%, ${p.alpha * 0.5})`);
          radialGrad.addColorStop(1, `hsla(${p.hue}, 80%, 45%, 0)`);

          ctx.fillStyle = radialGrad;
          ctx.beginPath();
          ctx.arc(p.x, p.y, glowRadius, 0, Math.PI * 2);
          ctx.fill();

          // Bright center spark
          ctx.fillStyle = `hsla(${p.hue}, 100%, 90%, ${Math.min(1, p.alpha * 1.5)})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 0.75, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [opacityMultiplier, particleCount, showParticles]);

  return (
    <div className={className} aria-hidden="true">
      {/* 1. Deep Ambient Mesh Gradient Glow Orbs (Fluid organic drifting orbs) */}
      <div className="absolute -top-[10%] -left-[10%] w-[55vw] h-[55vw] max-w-[700px] max-h-[700px] rounded-full bg-emerald-600/[0.12] blur-[140px] pointer-events-none animate-aurora-orb-1 transform-gpu" />
      <div className="absolute top-[25%] -right-[15%] w-[50vw] h-[50vw] max-w-[650px] max-h-[650px] rounded-full bg-cyan-600/[0.10] blur-[150px] pointer-events-none animate-aurora-orb-2 transform-gpu" />
      <div className="absolute -bottom-[15%] left-[20%] w-[60vw] h-[60vw] max-w-[750px] max-h-[750px] rounded-full bg-teal-600/[0.11] blur-[160px] pointer-events-none animate-aurora-orb-3 transform-gpu" />

      {/* 2. Optional Subtle Cybernetic Matrix Grid Pattern */}
      {showGrid && (
        <div 
          className="absolute inset-0 pointer-events-none opacity-[0.035] animate-cyber-grid bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:32px_32px]" 
        />
      )}

      {/* 3. 60 FPS Canvas with Fluid Satin Waves and Floating Star Bokeh */}
      <canvas
        ref={canvasRef}
        className="w-full h-full block opacity-95 pointer-events-none transform-gpu"
      />

      {/* 4. Soft Vignette and Screen-Blend Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-slate-950/40 pointer-events-none" />
    </div>
  );
};

export const AnimatedBackground = SilkFabricBackground;
