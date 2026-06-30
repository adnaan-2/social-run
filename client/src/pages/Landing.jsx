import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Footprints,
  TrendingUp,
  MapPin,
  Users,
  ArrowRight,
  Shield,
  Award,
  Calendar,
  ChevronRight,
  Send,
  CheckCircle,
  Zap,
  Globe,
  Heart,
  Target,
  Sparkles,
  Play,
  Star,
  ChevronDown,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

/* ──────────────────────────────────────────────
   SCROLL ANIMATION HOOK
   ────────────────────────────────────────────── */
function useScrollReveal(threshold = 0.15) {
  const ref = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [threshold]);

  return [ref, isVisible];
}

/* ──────────────────────────────────────────────
   ANIMATED COUNTER COMPONENT
   ────────────────────────────────────────────── */
function AnimatedCounter({ end, duration = 2000, suffix = '', prefix = '' }) {
  const [count, setCount] = useState(0);
  const [ref, isVisible] = useScrollReveal(0.3);
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (!isVisible || hasAnimated.current) return;
    hasAnimated.current = true;
    const startTime = Date.now();
    const timer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * end));
      if (progress >= 1) clearInterval(timer);
    }, 16);
    return () => clearInterval(timer);
  }, [isVisible, end, duration]);

  return <span ref={ref}>{prefix}{count.toLocaleString()}{suffix}</span>;
}

/* ──────────────────────────────────────────────
   3D GLOBE / MAP CANVAS
   ────────────────────────────────────────────── */
function Globe3D() {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const mouseRef = useRef({ x: 0, y: 0 });
  const timeRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let width, height;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
    };

    resize();
    window.addEventListener('resize', resize);

    const handleMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = {
        x: (e.clientX - rect.left) / rect.width - 0.5,
        y: (e.clientY - rect.top) / rect.height - 0.5,
      };
    };
    canvas.addEventListener('mousemove', handleMouseMove);

    // Globe parameters
    const cx = () => width / 2;
    const cy = () => height / 2;
    const R = () => Math.min(width, height) * 0.38;

    // Generate grid lines (latitude and longitude)
    const latLines = 12;
    const lonLines = 18;

    // Generate random run paths on the globe
    const runPaths = [];
    for (let i = 0; i < 8; i++) {
      const startLat = (Math.random() - 0.5) * Math.PI * 0.8;
      const startLon = Math.random() * Math.PI * 2;
      const path = [];
      let lat = startLat;
      let lon = startLon;
      for (let j = 0; j < 20; j++) {
        path.push({ lat, lon });
        lat += (Math.random() - 0.5) * 0.15;
        lon += (Math.random() - 0.3) * 0.12;
      }
      runPaths.push({
        path,
        color: ['#00D4AA', '#38bdf8', '#f472b6', '#a78bfa', '#fbbf24', '#34d399', '#f87171', '#60a5fa'][i],
        progress: Math.random(),
        speed: 0.002 + Math.random() * 0.003,
      });
    }

    // Floating runner dots
    const runners = [];
    for (let i = 0; i < 15; i++) {
      runners.push({
        lat: (Math.random() - 0.5) * Math.PI * 0.85,
        lon: Math.random() * Math.PI * 2,
        size: 2 + Math.random() * 3,
        pulse: Math.random() * Math.PI * 2,
        color: ['#00D4AA', '#38bdf8', '#f472b6', '#a78bfa', '#fbbf24'][Math.floor(Math.random() * 5)],
      });
    }

    // Connection lines between nearby runners
    const connections = [];
    for (let i = 0; i < runners.length; i++) {
      for (let j = i + 1; j < runners.length; j++) {
        const dist = Math.sqrt(
          Math.pow(runners[i].lat - runners[j].lat, 2) +
          Math.pow(runners[i].lon - runners[j].lon, 2)
        );
        if (dist < 1.2) {
          connections.push({ from: i, to: j, dist });
        }
      }
    }

    // Project 3D point to 2D
    const project = (lat, lon, rotation, tilt) => {
      const x = Math.cos(lat) * Math.sin(lon + rotation);
      const y = Math.sin(lat) * Math.cos(tilt) - Math.cos(lat) * Math.sin(tilt) * Math.cos(lon + rotation);
      const z = Math.sin(lat) * Math.sin(tilt) + Math.cos(lat) * Math.cos(tilt) * Math.cos(lon + rotation);
      return {
        x: cx() + x * R(),
        y: cy() - y * R(),
        z,
        visible: z > -0.1,
      };
    };

    const draw = () => {
      timeRef.current += 0.008;
      const t = timeRef.current;
      const rotation = t * 0.3 + mouseRef.current.x * 1.5;
      const tilt = 0.3 + mouseRef.current.y * 0.5;

      ctx.clearRect(0, 0, width, height);

      // Glow behind globe
      const glow = ctx.createRadialGradient(cx(), cy(), R() * 0.2, cx(), cy(), R() * 1.6);
      glow.addColorStop(0, 'rgba(0, 212, 170, 0.08)');
      glow.addColorStop(0.5, 'rgba(0, 212, 170, 0.03)');
      glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, width, height);

      // Globe base circle (dark glass sphere)
      const sphereGrad = ctx.createRadialGradient(
        cx() - R() * 0.3, cy() - R() * 0.3, 0,
        cx(), cy(), R()
      );
      sphereGrad.addColorStop(0, 'rgba(30, 40, 35, 0.6)');
      sphereGrad.addColorStop(0.7, 'rgba(15, 25, 20, 0.5)');
      sphereGrad.addColorStop(1, 'rgba(5, 15, 10, 0.3)');
      ctx.beginPath();
      ctx.arc(cx(), cy(), R(), 0, Math.PI * 2);
      ctx.fillStyle = sphereGrad;
      ctx.fill();

      // Globe outline
      ctx.beginPath();
      ctx.arc(cx(), cy(), R(), 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0, 212, 170, 0.15)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Draw latitude lines
      for (let i = 0; i <= latLines; i++) {
        const lat = ((i / latLines) - 0.5) * Math.PI;
        ctx.beginPath();
        let started = false;
        for (let j = 0; j <= 60; j++) {
          const lon = (j / 60) * Math.PI * 2;
          const p = project(lat, lon, rotation, tilt);
          if (p.visible) {
            if (!started) {
              ctx.moveTo(p.x, p.y);
              started = true;
            } else {
              ctx.lineTo(p.x, p.y);
            }
          } else {
            started = false;
          }
        }
        ctx.strokeStyle = 'rgba(0, 212, 170, 0.06)';
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }

      // Draw longitude lines
      for (let i = 0; i < lonLines; i++) {
        const lon = (i / lonLines) * Math.PI * 2;
        ctx.beginPath();
        let started = false;
        for (let j = 0; j <= 40; j++) {
          const lat = ((j / 40) - 0.5) * Math.PI;
          const p = project(lat, lon, rotation, tilt);
          if (p.visible) {
            if (!started) {
              ctx.moveTo(p.x, p.y);
              started = true;
            } else {
              ctx.lineTo(p.x, p.y);
            }
          } else {
            started = false;
          }
        }
        ctx.strokeStyle = 'rgba(0, 212, 170, 0.06)';
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }

      // Draw run paths
      runPaths.forEach((rp) => {
        rp.progress = (rp.progress + rp.speed) % 1;
        ctx.beginPath();
        let started = false;
        let lastVisible = false;
        rp.path.forEach((pt, idx) => {
          const p = project(pt.lat, pt.lon, rotation, tilt);
          if (p.visible) {
            const alpha = 0.15 + p.z * 0.4;
            if (!started || !lastVisible) {
              ctx.moveTo(p.x, p.y);
              started = true;
            } else {
              ctx.lineTo(p.x, p.y);
            }
            lastVisible = true;
          } else {
            lastVisible = false;
          }
        });
        ctx.strokeStyle = rp.color + '60';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Animated dot along path
        const pathIdx = Math.floor(rp.progress * (rp.path.length - 1));
        const pt = rp.path[pathIdx];
        const p = project(pt.lat, pt.lon, rotation, tilt);
        if (p.visible) {
          const pulseSize = 3 + Math.sin(t * 4 + rp.progress * 10) * 2;
          // Outer glow
          ctx.beginPath();
          ctx.arc(p.x, p.y, pulseSize * 3, 0, Math.PI * 2);
          ctx.fillStyle = rp.color + '15';
          ctx.fill();
          // Inner dot
          ctx.beginPath();
          ctx.arc(p.x, p.y, pulseSize, 0, Math.PI * 2);
          ctx.fillStyle = rp.color;
          ctx.fill();
        }
      });

      // Draw runners
      runners.forEach((runner, i) => {
        runner.pulse += 0.03;
        const p = project(runner.lat, runner.lon, rotation, tilt);
        if (p.visible) {
          const alpha = 0.3 + p.z * 0.7;
          const pulse = 1 + Math.sin(runner.pulse) * 0.3;
          // Glow
          ctx.beginPath();
          ctx.arc(p.x, p.y, runner.size * pulse * 3, 0, Math.PI * 2);
          ctx.fillStyle = runner.color + Math.floor(alpha * 25).toString(16).padStart(2, '0');
          ctx.fill();
          // Dot
          ctx.beginPath();
          ctx.arc(p.x, p.y, runner.size * pulse, 0, Math.PI * 2);
          ctx.fillStyle = runner.color + Math.floor(alpha * 255).toString(16).padStart(2, '0');
          ctx.fill();
        }
      });

      // Draw connections
      connections.forEach(({ from, to }) => {
        const p1 = project(runners[from].lat, runners[from].lon, rotation, tilt);
        const p2 = project(runners[to].lat, runners[to].lon, rotation, tilt);
        if (p1.visible && p2.visible) {
          const alpha = Math.min(p1.z, p2.z) * 0.15;
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = `rgba(0, 212, 170, ${alpha})`;
          ctx.lineWidth = 0.5;
          ctx.setLineDash([4, 4]);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      });

      // Highlight ring / atmosphere effect
      const atmosGrad = ctx.createRadialGradient(cx(), cy(), R() * 0.95, cx(), cy(), R() * 1.15);
      atmosGrad.addColorStop(0, 'rgba(0, 212, 170, 0.05)');
      atmosGrad.addColorStop(0.5, 'rgba(0, 212, 170, 0.02)');
      atmosGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.beginPath();
      ctx.arc(cx(), cy(), R() * 1.15, 0, Math.PI * 2);
      ctx.fillStyle = atmosGrad;
      ctx.fill();

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationRef.current);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: '100%',
        height: '100%',
        display: 'block',
        cursor: 'grab',
      }}
    />
  );
}

/* ──────────────────────────────────────────────
   RUNNING FRIENDS ANIMATION (SVG)
   ────────────────────────────────────────────── */
function RunningFriends() {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setFrame((f) => f + 1), 50);
    return () => clearInterval(interval);
  }, []);

  const runners = [
    { x: 0, color: '#00D4AA', delay: 0, name: 'You' },
    { x: 60, color: '#38bdf8', delay: 0.3, name: 'Alex' },
    { x: 120, color: '#f472b6', delay: 0.6, name: 'Sam' },
  ];

  return (
    <svg viewBox="0 0 400 120" style={{ width: '100%', maxWidth: 400, height: 'auto' }}>
      {/* Ground/path */}
      <defs>
        <linearGradient id="pathGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgba(0,212,170,0)" />
          <stop offset="20%" stopColor="rgba(0,212,170,0.3)" />
          <stop offset="80%" stopColor="rgba(0,212,170,0.3)" />
          <stop offset="100%" stopColor="rgba(0,212,170,0)" />
        </linearGradient>
      </defs>
      <line x1="0" y1="95" x2="400" y2="95" stroke="url(#pathGrad)" strokeWidth="2" strokeDasharray="8 4" />

      {runners.map((runner, i) => {
        const t = (frame * 0.06 + runner.delay) % (Math.PI * 2);
        const bounceY = Math.abs(Math.sin(t * 2)) * 12;
        const legAngle = Math.sin(t * 2) * 30;
        const armAngle = Math.sin(t * 2 + Math.PI) * 25;
        const baseX = 80 + runner.x;
        const baseY = 85 - bounceY;

        return (
          <g key={i}>
            {/* Shadow */}
            <ellipse
              cx={baseX}
              cy={95}
              rx={8 - bounceY * 0.3}
              ry={3 - bounceY * 0.1}
              fill="rgba(0,0,0,0.15)"
            />

            {/* Pulse ring around runner */}
            <circle
              cx={baseX}
              cy={baseY - 15}
              r={20 + Math.sin(frame * 0.08 + i) * 4}
              fill="none"
              stroke={runner.color}
              strokeWidth="0.5"
              opacity={0.2 + Math.sin(frame * 0.08 + i) * 0.1}
            />

            {/* Body */}
            <line
              x1={baseX}
              y1={baseY - 25}
              x2={baseX}
              y2={baseY - 8}
              stroke={runner.color}
              strokeWidth="3"
              strokeLinecap="round"
            />

            {/* Head */}
            <circle cx={baseX} cy={baseY - 30} r={5} fill={runner.color} />

            {/* Left leg */}
            <line
              x1={baseX}
              y1={baseY - 8}
              x2={baseX + Math.sin((legAngle * Math.PI) / 180) * 12}
              y2={baseY + Math.cos((legAngle * Math.PI) / 180) * 10}
              stroke={runner.color}
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            {/* Right leg */}
            <line
              x1={baseX}
              y1={baseY - 8}
              x2={baseX + Math.sin((-legAngle * Math.PI) / 180) * 12}
              y2={baseY + Math.cos((-legAngle * Math.PI) / 180) * 10}
              stroke={runner.color}
              strokeWidth="2.5"
              strokeLinecap="round"
            />

            {/* Left arm */}
            <line
              x1={baseX}
              y1={baseY - 22}
              x2={baseX + Math.sin((armAngle * Math.PI) / 180) * 10}
              y2={baseY - 15 + Math.cos((armAngle * Math.PI) / 180) * 6}
              stroke={runner.color}
              strokeWidth="2"
              strokeLinecap="round"
            />
            {/* Right arm */}
            <line
              x1={baseX}
              y1={baseY - 22}
              x2={baseX + Math.sin((-armAngle * Math.PI) / 180) * 10}
              y2={baseY - 15 + Math.cos((-armAngle * Math.PI) / 180) * 6}
              stroke={runner.color}
              strokeWidth="2"
              strokeLinecap="round"
            />

            {/* Name tag */}
            <text
              x={baseX}
              y={baseY - 42}
              textAnchor="middle"
              fill={runner.color}
              fontSize="9"
              fontWeight="700"
              fontFamily="Inter, sans-serif"
            >
              {runner.name}
            </text>
          </g>
        );
      })}

      {/* Sparkle particles */}
      {[...Array(6)].map((_, i) => {
        const sparkleX = 50 + (i * 60) + Math.sin(frame * 0.04 + i * 2) * 20;
        const sparkleY = 30 + Math.cos(frame * 0.05 + i * 1.5) * 25;
        const sparkleOpacity = 0.2 + Math.sin(frame * 0.08 + i) * 0.2;
        return (
          <circle
            key={i}
            cx={sparkleX}
            cy={sparkleY}
            r={1.5}
            fill="#00D4AA"
            opacity={sparkleOpacity}
          />
        );
      })}
    </svg>
  );
}

/* ──────────────────────────────────────────────
   PARTICLE FIELD BACKGROUND
   ────────────────────────────────────────────── */
function ParticleField() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const particles = Array.from({ length: 50 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      size: Math.random() * 2 + 0.5,
      opacity: Math.random() * 0.3 + 0.05,
    }));

    let animId;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 212, 170, ${p.opacity})`;
        ctx.fill();
      });

      animId = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  );
}

/* ──────────────────────────────────────────────
   SCROLL REVEAL WRAPPER
   ────────────────────────────────────────────── */
function RevealSection({ children, delay = 0, direction = 'up', style = {} }) {
  const [ref, isVisible] = useScrollReveal(0.1);

  const transforms = {
    up: 'translateY(60px)',
    down: 'translateY(-60px)',
    left: 'translateX(-60px)',
    right: 'translateX(60px)',
    scale: 'scale(0.9)',
  };

  return (
    <div
      ref={ref}
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'none' : transforms[direction],
        transition: `opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1) ${delay}s, transform 0.8s cubic-bezier(0.16, 1, 0.3, 1) ${delay}s`,
        willChange: 'opacity, transform',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/* ──────────────────────────────────────────────
   MAIN LANDING COMPONENT
   ────────────────────────────────────────────── */
export default function Landing() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState('home');
  const [scrollY, setScrollY] = useState(0);
  const [navSolid, setNavSolid] = useState(false);

  // Contact Form state
  const [contactData, setContactData] = useState({ name: '', email: '', message: '' });
  const [submitted, setSubmitted] = useState(false);

  // Scroll tracking
  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
      setNavSolid(window.scrollY > 80);

      const sections = ['home', 'about', 'features', 'how-it-works', 'stats', 'contact'];
      const scrollPosition = window.scrollY + 200;
      for (const section of sections) {
        const el = document.getElementById(section);
        if (el) {
          const top = el.offsetTop;
          const height = el.offsetHeight;
          if (scrollPosition >= top && scrollPosition < top + height) {
            setActiveSection(section);
            break;
          }
        }
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleContactSubmit = (e) => {
    e.preventDefault();
    if (contactData.email && contactData.message) {
      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        setContactData({ name: '', email: '', message: '' });
      }, 3000);
    }
  };

  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  const features = [
    {
      title: 'GPS Walk Tracking',
      description: 'Real-time route mapping with anti-cheat GPS validation. Every step counts, verified.',
      icon: MapPin,
      gradient: 'linear-gradient(135deg, #00D4AA 0%, #00B894 100%)',
    },
    {
      title: 'Streak System',
      description: 'Build daily walking habits with streak freezes, XP rewards, and level progression.',
      icon: TrendingUp,
      gradient: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
    },
    {
      title: 'Live Social Map',
      description: 'Discover active walkers nearby in real-time. Connect, motivate, and walk together.',
      icon: Globe,
      gradient: 'linear-gradient(135deg, #38bdf8 0%, #0ea5e9 100%)',
    },
    {
      title: 'Buddy Walks',
      description: 'Coordinate walks with friends. Share routes live, sync paces, and compete together.',
      icon: Users,
      gradient: 'linear-gradient(135deg, #f472b6 0%, #ec4899 100%)',
    },
    {
      title: 'Achievements & Badges',
      description: 'Unlock collector badges, earn XP milestones, and showcase your fitness journey.',
      icon: Award,
      gradient: 'linear-gradient(135deg, #a78bfa 0%, #8b5cf6 100%)',
    },
    {
      title: 'Smart Protection',
      description: 'Streak freezes protect your progress on rest days. Stay motivated without burnout.',
      icon: Shield,
      gradient: 'linear-gradient(135deg, #34d399 0%, #10b981 100%)',
    },
  ];

  const steps = [
    {
      step: '01',
      title: 'Lace Up & Start',
      text: 'Open the app, hit start, and let GPS map your walk in real-time with live distance tracking.',
      icon: Play,
    },
    {
      step: '02',
      title: 'Build Your Streak',
      text: 'Walk at least once every 24 hours. Watch your streak grow and earn XP with every session.',
      icon: Zap,
    },
    {
      step: '03',
      title: 'Connect & Compete',
      text: 'Find nearby walkers on the live map, send buddy requests, and walk together in real-time.',
      icon: Heart,
    },
    {
      step: '04',
      title: 'Level Up',
      text: 'Earn achievements, unlock badges, and climb levels as your walking habit transforms your life.',
      icon: Target,
    },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#0A0F0D', color: '#ffffff', overflowX: 'hidden' }}>
      <ParticleField />

      {/* ===== FLOATING NAVBAR ===== */}
      <header
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          padding: '12px 20px',
          transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <div
          style={{
            maxWidth: 1200,
            margin: '0 auto',
            padding: '12px 28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderRadius: 999,
            background: navSolid ? 'rgba(10, 15, 13, 0.85)' : 'rgba(10, 15, 13, 0.4)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: `1px solid ${navSolid ? 'rgba(0, 212, 170, 0.15)' : 'rgba(255, 255, 255, 0.06)'}`,
            transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
            boxShadow: navSolid ? '0 8px 32px rgba(0, 0, 0, 0.4)' : 'none',
          }}
        >
          {/* Logo */}
          <div
            onClick={() => scrollToSection('home')}
            style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #00D4AA 0%, #00B894 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 20px rgba(0, 212, 170, 0.3)',
              }}
            >
              <Footprints size={18} strokeWidth={2.5} color="#0A0F0D" />
            </div>
            <strong style={{ fontSize: 18, color: '#ffffff', letterSpacing: -0.5 }}>
              Walk<span style={{ color: '#00D4AA' }}>Streak</span>
            </strong>
          </div>

          {/* Center Nav Links */}
          <nav style={{ display: 'flex', alignItems: 'center', gap: 8 }} className="landing-nav-links">
            {[
              { id: 'home', label: 'Home' },
              { id: 'about', label: 'About' },
              { id: 'features', label: 'Features' },
              { id: 'how-it-works', label: 'How it works' },
              { id: 'contact', label: 'Contact' },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => scrollToSection(item.id)}
                style={{
                  background: activeSection === item.id ? 'rgba(0, 212, 170, 0.12)' : 'transparent',
                  border: 'none',
                  fontSize: 13,
                  fontWeight: 500,
                  color: activeSection === item.id ? '#00D4AA' : 'rgba(255, 255, 255, 0.55)',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  padding: '6px 14px',
                  borderRadius: 999,
                  fontFamily: 'inherit',
                }}
              >
                {item.label}
              </button>
            ))}
          </nav>

          {/* Right CTA */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {user ? (
              <button
                onClick={() => navigate('/dashboard')}
                style={{
                  background: 'linear-gradient(135deg, #00D4AA 0%, #00B894 100%)',
                  color: '#0A0F0D',
                  fontWeight: 700,
                  border: 'none',
                  padding: '9px 22px',
                  borderRadius: 999,
                  fontSize: 13,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  boxShadow: '0 0 20px rgba(0, 212, 170, 0.25)',
                  transition: 'all 0.3s ease',
                }}
              >
                Dashboard
              </button>
            ) : (
              <>
                <Link
                  to="/login"
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    textDecoration: 'none',
                    color: 'rgba(255, 255, 255, 0.7)',
                    padding: '9px 18px',
                    borderRadius: 999,
                    transition: 'color 0.3s ease',
                  }}
                >
                  Sign in
                </Link>
                <Link
                  to="/signup"
                  style={{
                    background: 'linear-gradient(135deg, #00D4AA 0%, #00B894 100%)',
                    color: '#0A0F0D',
                    fontWeight: 700,
                    textDecoration: 'none',
                    padding: '9px 22px',
                    borderRadius: 999,
                    fontSize: 13,
                    boxShadow: '0 0 20px rgba(0, 212, 170, 0.25)',
                    transition: 'all 0.3s ease',
                  }}
                >
                  Get started
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ===== HERO SECTION ===== */}
      <section
        id="home"
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          position: 'relative',
          paddingTop: 120,
          paddingBottom: 80,
          paddingLeft: 24,
          paddingRight: 24,
          overflow: 'hidden',
        }}
      >
        {/* Hero background gradient orbs */}
        <div style={{
          position: 'absolute', top: '-20%', right: '-10%',
          width: '60%', height: '80%', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0,212,170,0.08) 0%, transparent 70%)',
          filter: 'blur(80px)', pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: '-10%', left: '-10%',
          width: '50%', height: '60%', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(56,189,248,0.05) 0%, transparent 70%)',
          filter: 'blur(80px)', pointerEvents: 'none',
        }} />

        <div
          style={{
            maxWidth: 1200,
            margin: '0 auto',
            width: '100%',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 60,
            alignItems: 'center',
            position: 'relative',
            zIndex: 1,
          }}
          className="landing-hero-grid"
        >
          {/* Left: Text Content */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <RevealSection delay={0}>
              {/* Badge */}
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  background: 'rgba(0, 212, 170, 0.08)',
                  border: '1px solid rgba(0, 212, 170, 0.2)',
                  padding: '8px 18px',
                  borderRadius: 999,
                  marginBottom: 28,
                }}
              >
                <Sparkles size={14} color="#00D4AA" />
                <span style={{
                  fontSize: 12, fontWeight: 700, color: '#00D4AA',
                  textTransform: 'uppercase', letterSpacing: 1.5,
                }}>
                  Social fitness, reimagined
                </span>
              </div>
            </RevealSection>

            <RevealSection delay={0.1}>
              <h1
                style={{
                  fontSize: 'clamp(2.8rem, 5.5vw, 4.5rem)',
                  fontWeight: 900,
                  lineHeight: 1.05,
                  marginBottom: 24,
                  letterSpacing: -2,
                }}
              >
                <span style={{ color: '#ffffff', display: 'block' }}>Run together.</span>
                <span style={{
                  background: 'linear-gradient(135deg, #00D4AA 0%, #38bdf8 50%, #a78bfa 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  display: 'block',
                }}>
                  Grow together.
                </span>
              </h1>
            </RevealSection>

            <RevealSection delay={0.2}>
              <p
                style={{
                  fontSize: 17,
                  lineHeight: 1.7,
                  color: 'rgba(255, 255, 255, 0.55)',
                  marginBottom: 40,
                  maxWidth: 480,
                }}
              >
                Track your walks with GPS validation, discover active friends on a live 3D map, and build streaks that keep you moving. Fitness is better with friends.
              </p>
            </RevealSection>

            <RevealSection delay={0.3}>
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                <button
                  onClick={() => navigate('/signup')}
                  style={{
                    background: 'linear-gradient(135deg, #00D4AA 0%, #00B894 100%)',
                    color: '#0A0F0D',
                    fontWeight: 800,
                    border: 'none',
                    padding: '16px 36px',
                    borderRadius: 16,
                    fontSize: 16,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    boxShadow: '0 0 40px rgba(0, 212, 170, 0.3), 0 4px 20px rgba(0, 0, 0, 0.3)',
                    transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)';
                    e.currentTarget.style.boxShadow = '0 0 60px rgba(0, 212, 170, 0.4), 0 8px 30px rgba(0, 0, 0, 0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'none';
                    e.currentTarget.style.boxShadow = '0 0 40px rgba(0, 212, 170, 0.3), 0 4px 20px rgba(0, 0, 0, 0.3)';
                  }}
                >
                  Start your streak
                  <ArrowRight size={18} />
                </button>
                <button
                  onClick={() => navigate('/login')}
                  style={{
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: '#ffffff',
                    padding: '16px 32px',
                    borderRadius: 16,
                    fontSize: 16,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    backdropFilter: 'blur(10px)',
                    transition: 'all 0.3s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(0, 212, 170, 0.3)';
                    e.currentTarget.style.background = 'rgba(0, 212, 170, 0.06)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                  }}
                >
                  Sign in
                </button>
              </div>
            </RevealSection>

            {/* Running friends animation below CTA */}
            <RevealSection delay={0.5}>
              <div style={{ marginTop: 48, opacity: 0.8 }}>
                <RunningFriends />
              </div>
            </RevealSection>
          </div>

          {/* Right: 3D Globe */}
          <RevealSection delay={0.2} direction="right">
            <div
              style={{
                width: '100%',
                aspectRatio: '1 / 1',
                maxWidth: 560,
                margin: '0 auto',
                position: 'relative',
              }}
            >
              <Globe3D />

              {/* Floating stat cards around globe */}
              <div
                style={{
                  position: 'absolute',
                  top: '10%',
                  right: '-5%',
                  background: 'rgba(10, 15, 13, 0.7)',
                  backdropFilter: 'blur(16px)',
                  border: '1px solid rgba(0, 212, 170, 0.2)',
                  borderRadius: 16,
                  padding: '12px 18px',
                  animation: 'floatCard 4s ease-in-out infinite',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#00D4AA', boxShadow: '0 0 8px #00D4AA' }} />
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>Live walkers</span>
                </div>
                <strong style={{ fontSize: 22, color: '#00D4AA', display: 'block', marginTop: 4 }}>2,847</strong>
              </div>

              <div
                style={{
                  position: 'absolute',
                  bottom: '15%',
                  left: '-8%',
                  background: 'rgba(10, 15, 13, 0.7)',
                  backdropFilter: 'blur(16px)',
                  border: '1px solid rgba(56, 189, 248, 0.2)',
                  borderRadius: 16,
                  padding: '12px 18px',
                  animation: 'floatCard 5s ease-in-out infinite 1s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <TrendingUp size={14} color="#38bdf8" />
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>Avg streak</span>
                </div>
                <strong style={{ fontSize: 22, color: '#38bdf8', display: 'block', marginTop: 4 }}>21 days</strong>
              </div>
            </div>
          </RevealSection>
        </div>

        {/* Scroll indicator */}
        <div
          style={{
            position: 'absolute',
            bottom: 32,
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
            animation: 'bounce 2s ease-in-out infinite',
            cursor: 'pointer',
          }}
          onClick={() => scrollToSection('about')}
        >
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', letterSpacing: 2, textTransform: 'uppercase' }}>
            Scroll to explore
          </span>
          <ChevronDown size={18} color="rgba(255,255,255,0.35)" />
        </div>
      </section>

      {/* ===== ABOUT SECTION ===== */}
      <section
        id="about"
        style={{
          padding: '120px 24px',
          position: 'relative',
          background: 'linear-gradient(180deg, #0A0F0D 0%, #0D1411 100%)',
        }}
      >
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 1,
          background: 'linear-gradient(90deg, transparent, rgba(0,212,170,0.2), transparent)',
        }} />
        <div style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>
          <RevealSection>
            <span style={{
              fontSize: 12, fontWeight: 800, color: '#00D4AA',
              textTransform: 'uppercase', letterSpacing: 3, display: 'block', marginBottom: 16,
            }}>
              Why WalkStreak
            </span>
            <h2 style={{
              fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 900,
              marginBottom: 20, letterSpacing: -1, lineHeight: 1.1,
            }}>
              Walking is powerful.{' '}
              <span style={{ color: '#00D4AA' }}>Doing it together</span> is unstoppable.
            </h2>
            <p style={{
              fontSize: 16, lineHeight: 1.8, color: 'rgba(255,255,255,0.5)',
              maxWidth: 650, margin: '0 auto 60px',
            }}>
              WalkStreak blends fitness tracking with social accountability, turning daily steps into
              streaks you build alongside friends. Every walk counts, every connection matters.
            </p>
          </RevealSection>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 24,
          }}>
            {[
              {
                title: 'Gamified Motivation',
                desc: 'Earn XP for every kilometer, level up your profile, and unlock achievements and badges that showcase your journey.',
                icon: '🏆',
              },
              {
                title: 'Social Encouragement',
                desc: 'Invite friends for buddy walks, share real-time locations, and coordinate fitness sessions with nearby walkers.',
                icon: '🤝',
              },
              {
                title: 'Accountability Tools',
                desc: 'Streak freezes protect your progress on rest days, keeping you motivated without the pressure of starting over.',
                icon: '🛡️',
              },
            ].map((item, i) => (
              <RevealSection key={i} delay={i * 0.15}>
                <div
                  style={{
                    padding: 32,
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    borderRadius: 20,
                    textAlign: 'left',
                    transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                    cursor: 'default',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(0, 212, 170, 0.2)';
                    e.currentTarget.style.background = 'rgba(0, 212, 170, 0.04)';
                    e.currentTarget.style.transform = 'translateY(-4px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)';
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
                    e.currentTarget.style.transform = 'none';
                  }}
                >
                  <span style={{ fontSize: 32, display: 'block', marginBottom: 16 }}>{item.icon}</span>
                  <strong style={{ fontSize: 18, color: '#ffffff', display: 'block', marginBottom: 10 }}>
                    {item.title}
                  </strong>
                  <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', lineHeight: 1.7 }}>
                    {item.desc}
                  </p>
                </div>
              </RevealSection>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FEATURES SECTION ===== */}
      <section
        id="features"
        style={{
          padding: '120px 24px',
          position: 'relative',
          background: '#0D1411',
        }}
      >
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 1,
          background: 'linear-gradient(90deg, transparent, rgba(0,212,170,0.15), transparent)',
        }} />
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <RevealSection>
            <div style={{ textAlign: 'center', marginBottom: 64 }}>
              <span style={{
                fontSize: 12, fontWeight: 800, color: '#00D4AA',
                textTransform: 'uppercase', letterSpacing: 3, display: 'block', marginBottom: 16,
              }}>
                Features
              </span>
              <h2 style={{
                fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 900,
                marginBottom: 16, letterSpacing: -1,
              }}>
                Everything you need to{' '}
                <span style={{ color: '#00D4AA' }}>stay moving</span>
              </h2>
              <p style={{
                fontSize: 16, color: 'rgba(255,255,255,0.5)',
                maxWidth: 550, margin: '0 auto',
              }}>
                Powerful tools designed to make your walking habit consistent, social, and rewarding.
              </p>
            </div>
          </RevealSection>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 20,
          }}>
            {features.map((feat, idx) => {
              const IconComp = feat.icon;
              return (
                <RevealSection key={idx} delay={idx * 0.1}>
                  <div
                    style={{
                      padding: 32,
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      borderRadius: 20,
                      display: 'flex',
                      gap: 20,
                      alignItems: 'flex-start',
                      transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                      cursor: 'default',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(0, 212, 170, 0.2)';
                      e.currentTarget.style.background = 'rgba(0, 212, 170, 0.03)';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)';
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
                      e.currentTarget.style.transform = 'none';
                    }}
                  >
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 14,
                        background: feat.gradient,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        boxShadow: `0 0 20px ${feat.gradient.includes('#00D4AA') ? 'rgba(0,212,170,0.2)' : 'rgba(255,255,255,0.05)'}`,
                      }}
                    >
                      <IconComp size={22} color="#0A0F0D" strokeWidth={2.5} />
                    </div>
                    <div>
                      <strong style={{ fontSize: 17, color: '#ffffff', display: 'block', marginBottom: 8 }}>
                        {feat.title}
                      </strong>
                      <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>
                        {feat.description}
                      </span>
                    </div>
                  </div>
                </RevealSection>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===== HOW IT WORKS SECTION ===== */}
      <section
        id="how-it-works"
        style={{
          padding: '120px 24px',
          position: 'relative',
          background: 'linear-gradient(180deg, #0D1411 0%, #0A0F0D 100%)',
        }}
      >
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 1,
          background: 'linear-gradient(90deg, transparent, rgba(0,212,170,0.15), transparent)',
        }} />
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <RevealSection>
            <div style={{ textAlign: 'center', marginBottom: 64 }}>
              <span style={{
                fontSize: 12, fontWeight: 800, color: '#00D4AA',
                textTransform: 'uppercase', letterSpacing: 3, display: 'block', marginBottom: 16,
              }}>
                How It Works
              </span>
              <h2 style={{
                fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 900,
                letterSpacing: -1,
              }}>
                Four steps to a{' '}
                <span style={{ color: '#00D4AA' }}>healthier you</span>
              </h2>
            </div>
          </RevealSection>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {steps.map((step, idx) => {
              const IconComp = step.icon;
              return (
                <RevealSection key={idx} delay={idx * 0.12} direction={idx % 2 === 0 ? 'left' : 'right'}>
                  <div
                    style={{
                      padding: '32px 36px',
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      borderRadius: 20,
                      display: 'flex',
                      gap: 24,
                      alignItems: 'center',
                      transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(0, 212, 170, 0.2)';
                      e.currentTarget.style.transform = 'translateX(8px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)';
                      e.currentTarget.style.transform = 'none';
                    }}
                  >
                    {/* Step number */}
                    <div
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: 16,
                        background: 'linear-gradient(135deg, #00D4AA 0%, #00B894 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        boxShadow: '0 0 24px rgba(0, 212, 170, 0.2)',
                      }}
                    >
                      <IconComp size={24} color="#0A0F0D" strokeWidth={2.5} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                        <span style={{
                          fontSize: 12, fontWeight: 800, color: '#00D4AA',
                          letterSpacing: 2, textTransform: 'uppercase',
                        }}>
                          Step {step.step}
                        </span>
                      </div>
                      <strong style={{ fontSize: 18, color: '#ffffff', display: 'block', marginBottom: 6 }}>
                        {step.title}
                      </strong>
                      <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>
                        {step.text}
                      </p>
                    </div>
                  </div>
                </RevealSection>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===== STATS SECTION ===== */}
      <section
        id="stats"
        style={{
          padding: '100px 24px',
          position: 'relative',
          background: '#0A0F0D',
        }}
      >
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 1,
          background: 'linear-gradient(90deg, transparent, rgba(0,212,170,0.15), transparent)',
        }} />
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <RevealSection>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 32,
                textAlign: 'center',
              }}
            >
              {[
                { value: 50000, suffix: '+', label: 'Active Walkers', color: '#00D4AA' },
                { value: 12, suffix: 'M+', label: 'Kilometers Tracked', color: '#38bdf8' },
                { value: 89, suffix: '%', label: 'Streak Retention', color: '#fbbf24' },
                { value: 150, suffix: '+', label: 'Countries', color: '#f472b6' },
              ].map((stat, i) => (
                <div
                  key={i}
                  style={{
                    padding: 32,
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    borderRadius: 20,
                    transition: 'all 0.3s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(0, 212, 170, 0.15)';
                    e.currentTarget.style.transform = 'translateY(-4px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)';
                    e.currentTarget.style.transform = 'none';
                  }}
                >
                  <div style={{ fontSize: 40, fontWeight: 900, color: stat.color, letterSpacing: -2 }}>
                    <AnimatedCounter end={stat.value} suffix={stat.suffix} />
                  </div>
                  <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', marginTop: 8, display: 'block' }}>
                    {stat.label}
                  </span>
                </div>
              ))}
            </div>
          </RevealSection>
        </div>
      </section>

      {/* ===== CTA BANNER ===== */}
      <section
        style={{
          padding: '100px 24px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <RevealSection direction="scale">
          <div
            style={{
              maxWidth: 800,
              margin: '0 auto',
              textAlign: 'center',
              padding: '64px 48px',
              background: 'linear-gradient(135deg, rgba(0,212,170,0.08) 0%, rgba(56,189,248,0.05) 100%)',
              border: '1px solid rgba(0, 212, 170, 0.15)',
              borderRadius: 32,
              position: 'relative',
            }}
          >
            {/* Glow effects */}
            <div style={{
              position: 'absolute', top: '-50%', left: '20%', width: 300, height: 300,
              borderRadius: '50%', background: 'rgba(0,212,170,0.06)', filter: 'blur(80px)', pointerEvents: 'none',
            }} />
            <h2 style={{
              fontSize: 'clamp(1.8rem, 3.5vw, 2.8rem)', fontWeight: 900,
              marginBottom: 16, letterSpacing: -1, position: 'relative',
            }}>
              Ready to start your{' '}
              <span style={{ color: '#00D4AA' }}>walking streak</span>?
            </h2>
            <p style={{
              fontSize: 16, color: 'rgba(255,255,255,0.5)',
              marginBottom: 32, maxWidth: 450, margin: '0 auto 32px', position: 'relative',
            }}>
              Join thousands of walkers building healthier habits together.
              It's free, it's fun, and it starts with one step.
            </p>
            <button
              onClick={() => navigate('/signup')}
              style={{
                background: 'linear-gradient(135deg, #00D4AA 0%, #00B894 100%)',
                color: '#0A0F0D',
                fontWeight: 800,
                border: 'none',
                padding: '18px 48px',
                borderRadius: 16,
                fontSize: 17,
                cursor: 'pointer',
                fontFamily: 'inherit',
                boxShadow: '0 0 50px rgba(0, 212, 170, 0.3)',
                transition: 'all 0.3s ease',
                position: 'relative',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.05)';
                e.currentTarget.style.boxShadow = '0 0 70px rgba(0, 212, 170, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.boxShadow = '0 0 50px rgba(0, 212, 170, 0.3)';
              }}
            >
              Get Started Free
              <ArrowRight size={20} />
            </button>
          </div>
        </RevealSection>
      </section>

      {/* ===== CONTACT SECTION ===== */}
      <section
        id="contact"
        style={{
          padding: '120px 24px',
          position: 'relative',
          background: '#0D1411',
        }}
      >
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 1,
          background: 'linear-gradient(90deg, transparent, rgba(0,212,170,0.15), transparent)',
        }} />
        <div
          style={{
            maxWidth: 900,
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: '1fr 1.2fr',
            gap: 48,
            alignItems: 'center',
          }}
          className="landing-hero-grid"
        >
          <RevealSection direction="left">
            <div>
              <span style={{
                fontSize: 12, fontWeight: 800, color: '#00D4AA',
                textTransform: 'uppercase', letterSpacing: 3, display: 'block', marginBottom: 16,
              }}>
                Get in Touch
              </span>
              <h2 style={{
                fontSize: 'clamp(1.8rem, 3.5vw, 2.5rem)', fontWeight: 900,
                marginBottom: 16, letterSpacing: -1,
              }}>
                Have questions?{' '}
                <span style={{ color: '#00D4AA' }}>Let's connect.</span>
              </h2>
              <p style={{
                fontSize: 15, color: 'rgba(255,255,255,0.45)', lineHeight: 1.7, marginBottom: 28,
              }}>
                Want to partner with us, report a bug, or share your fitness success story?
                Drop us a line and our team will reach out.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.35)', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <MapPin size={16} color="#00D4AA" /> San Francisco, CA
                </span>
                <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.35)', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Send size={16} color="#00D4AA" /> support@walkstreak.com
                </span>
              </div>
            </div>
          </RevealSection>

          <RevealSection direction="right" delay={0.15}>
            <div
              style={{
                padding: 36,
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 24,
                backdropFilter: 'blur(16px)',
              }}
            >
              {submitted ? (
                <div style={{ textAlign: 'center', padding: '32px 0' }}>
                  <div style={{
                    width: 56, height: 56, borderRadius: '50%',
                    background: 'rgba(0, 212, 170, 0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 16px',
                  }}>
                    <CheckCircle size={28} color="#00D4AA" />
                  </div>
                  <strong style={{ fontSize: 18, color: '#ffffff', display: 'block', marginBottom: 8 }}>
                    Message Sent!
                  </strong>
                  <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)' }}>
                    Thank you for reaching out. We'll get back to you shortly.
                  </span>
                </div>
              ) : (
                <form onSubmit={handleContactSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                  {[
                    { label: 'Name', type: 'text', key: 'name', placeholder: 'Your name' },
                    { label: 'Email', type: 'email', key: 'email', placeholder: 'you@email.com' },
                  ].map((field) => (
                    <div key={field.key}>
                      <label style={{
                        fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)',
                        textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 8,
                      }}>
                        {field.label}
                      </label>
                      <input
                        type={field.type}
                        required
                        value={contactData[field.key]}
                        onChange={(e) => setContactData({ ...contactData, [field.key]: e.target.value })}
                        placeholder={field.placeholder}
                        style={{
                          width: '100%',
                          padding: '14px 16px',
                          background: 'rgba(255, 255, 255, 0.04)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: 12,
                          color: '#ffffff',
                          fontSize: 14,
                          fontFamily: 'inherit',
                          outline: 'none',
                          transition: 'border-color 0.3s ease',
                          boxSizing: 'border-box',
                        }}
                        onFocus={(e) => e.target.style.borderColor = 'rgba(0, 212, 170, 0.4)'}
                        onBlur={(e) => e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)'}
                      />
                    </div>
                  ))}
                  <div>
                    <label style={{
                      fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)',
                      textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 8,
                    }}>
                      Message
                    </label>
                    <textarea
                      required
                      rows={4}
                      value={contactData.message}
                      onChange={(e) => setContactData({ ...contactData, message: e.target.value })}
                      placeholder="Tell us what's on your mind..."
                      style={{
                        width: '100%',
                        padding: '14px 16px',
                        background: 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: 12,
                        color: '#ffffff',
                        fontSize: 14,
                        fontFamily: 'inherit',
                        outline: 'none',
                        resize: 'none',
                        transition: 'border-color 0.3s ease',
                        boxSizing: 'border-box',
                      }}
                      onFocus={(e) => e.target.style.borderColor = 'rgba(0, 212, 170, 0.4)'}
                      onBlur={(e) => e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)'}
                    />
                  </div>
                  <button
                    type="submit"
                    style={{
                      background: 'linear-gradient(135deg, #00D4AA 0%, #00B894 100%)',
                      color: '#0A0F0D',
                      fontWeight: 700,
                      border: 'none',
                      padding: '14px',
                      borderRadius: 12,
                      fontSize: 15,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      boxShadow: '0 0 20px rgba(0, 212, 170, 0.2)',
                      transition: 'all 0.3s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.boxShadow = '0 0 30px rgba(0, 212, 170, 0.35)';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.boxShadow = '0 0 20px rgba(0, 212, 170, 0.2)';
                      e.currentTarget.style.transform = 'none';
                    }}
                  >
                    Send Message <Send size={15} />
                  </button>
                </form>
              )}
            </div>
          </RevealSection>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer
        style={{
          padding: '48px 24px 32px',
          background: '#080C0A',
          borderTop: '1px solid rgba(255, 255, 255, 0.04)',
        }}
      >
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 24,
            marginBottom: 32,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #00D4AA 0%, #00B894 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Footprints size={16} strokeWidth={2.5} color="#0A0F0D" />
              </div>
              <strong style={{ fontSize: 16, color: '#ffffff' }}>
                Walk<span style={{ color: '#00D4AA' }}>Streak</span>
              </strong>
            </div>
            <div style={{ display: 'flex', gap: 24 }}>
              {['About', 'Features', 'Contact'].map((link) => (
                <button
                  key={link}
                  onClick={() => scrollToSection(link.toLowerCase())}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'rgba(255,255,255,0.35)',
                    fontSize: 13,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    transition: 'color 0.3s ease',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#00D4AA'}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.35)'}
                >
                  {link}
                </button>
              ))}
            </div>
          </div>
          <div style={{
            borderTop: '1px solid rgba(255, 255, 255, 0.04)',
            paddingTop: 24,
            textAlign: 'center',
          }}>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)' }}>
              © 2026 WalkStreak Inc. All rights reserved. Keep walking, keep growing!
            </span>
          </div>
        </div>
      </footer>

      {/* ===== GLOBAL LANDING STYLES ===== */}
      <style>{`
        @keyframes floatCard {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-12px); }
        }

        @keyframes bounce {
          0%, 20%, 50%, 80%, 100% { transform: translateX(-50%) translateY(0); }
          40% { transform: translateX(-50%) translateY(-8px); }
          60% { transform: translateX(-50%) translateY(-4px); }
        }

        html {
          scroll-behavior: smooth;
        }

        @media (max-width: 900px) {
          .landing-hero-grid {
            grid-template-columns: 1fr !important;
            gap: 40px !important;
          }
          .landing-nav-links {
            display: none !important;
          }
        }

        @media (max-width: 600px) {
          .landing-hero-grid {
            gap: 32px !important;
          }
        }
      `}</style>
    </div>
  );
}
