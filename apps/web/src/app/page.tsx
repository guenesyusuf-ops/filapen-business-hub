import Link from 'next/link';
import {
  DollarSign,
  Users,
  Heart,
  Wand2,
  ArrowRight,
  BarChart3,
  Shield,
  Zap,
} from 'lucide-react';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gradient-to-b from-white via-gray-50/50 to-white relative overflow-hidden">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[400px] -right-[400px] w-[800px] h-[800px] rounded-full bg-gradient-to-br from-primary-100/30 to-transparent blur-3xl" />
        <div className="absolute -bottom-[300px] -left-[300px] w-[600px] h-[600px] rounded-full bg-gradient-to-tr from-accent-finance-light/20 to-transparent blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-gradient-to-br from-accent-creator-light/10 to-transparent blur-3xl" />
      </div>

      <div className="w-full max-w-2xl space-y-10 text-center relative z-10">
        {/* Hero */}
        <div className="space-y-4 animate-fade-in">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary-50 px-4 py-1.5 text-xs font-medium text-primary-700 border border-primary-100 mb-2">
            <Zap className="h-3 w-3" />
            All-in-one business platform
          </div>
          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight">
            <span className="bg-gradient-to-r from-gray-900 via-primary-800 to-primary-600 bg-clip-text text-transparent">
              Filapen
            </span>
            <br />
            <span className="text-gray-900">Business Hub</span>
          </h1>
          <p className="mt-3 text-lg text-gray-500 max-w-md mx-auto leading-relaxed">
            Track profits, manage creators, discover influencers, and generate content -- all from one premium dashboard.
          </p>
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 animate-slide-up">
          <Link
            href="/finance"
            className="group inline-flex items-center gap-2 w-full sm:w-auto justify-center rounded-xl bg-gradient-to-r from-primary-600 to-primary-700 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-primary-500/20 transition-all duration-200 hover:shadow-xl hover:shadow-primary-500/30 hover:-translate-y-0.5 active:scale-[0.98]"
          >
            Open Dashboard
            <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
          </Link>
          <Link
            href="/finance"
            className="inline-flex items-center gap-2 w-full sm:w-auto justify-center rounded-xl border border-gray-200 bg-white px-6 py-3 text-sm font-semibold text-gray-700 shadow-sm transition-all duration-200 hover:bg-gray-50 hover:border-gray-300 hover:-translate-y-0.5 active:scale-[0.98]"
          >
            Explore Hubs
          </Link>
        </div>

        {/* Hub Cards */}
        <div className="grid grid-cols-2 gap-4 animate-slide-up" style={{ animationDelay: '100ms', animationFillMode: 'both' }}>
          <HubCard
            title="Finance Hub"
            description="Revenue tracking, P&L analysis, ad spend optimization"
            icon={<DollarSign className="h-5 w-5" />}
            color="emerald"
            href="/finance"
          />
          <HubCard
            title="Creator Hub"
            description="Manage creator deals, briefings, and projects"
            icon={<Users className="h-5 w-5" />}
            color="violet"
            href="/creators"
          />
          <HubCard
            title="Influencer Hub"
            description="Discover and track influencer performance"
            icon={<Heart className="h-5 w-5" />}
            color="pink"
            href="/influencers"
          />
          <HubCard
            title="Content Hub"
            description="AI-powered content generation and management"
            icon={<Wand2 className="h-5 w-5" />}
            color="amber"
            href="/content"
          />
        </div>

        {/* Trust indicators */}
        <div className="flex items-center justify-center gap-6 pt-4 text-xs text-gray-400 animate-fade-in" style={{ animationDelay: '200ms', animationFillMode: 'both' }}>
          <span className="flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5" />
            Enterprise-grade security
          </span>
          <span className="flex items-center gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" />
            Real-time analytics
          </span>
          <span className="flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5" />
            Blazing fast
          </span>
        </div>
      </div>
    </main>
  );
}

const COLOR_MAP = {
  emerald: {
    bg: 'bg-emerald-50 group-hover:bg-emerald-100/80',
    icon: 'text-emerald-600',
    border: 'border-emerald-100 group-hover:border-emerald-200',
  },
  violet: {
    bg: 'bg-amber-50 group-hover:bg-amber-100/80',
    icon: 'text-amber-600',
    border: 'border-amber-100 group-hover:border-amber-200',
  },
  pink: {
    bg: 'bg-orange-50 group-hover:bg-orange-100/80',
    icon: 'text-orange-600',
    border: 'border-orange-100 group-hover:border-orange-200',
  },
  amber: {
    bg: 'bg-amber-50 group-hover:bg-amber-100/80',
    icon: 'text-amber-600',
    border: 'border-amber-100 group-hover:border-amber-200',
  },
} as const;

function HubCard({
  title,
  description,
  icon,
  color,
  href,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  color: keyof typeof COLOR_MAP;
  href: string;
}) {
  const colors = COLOR_MAP[color];

  return (
    <Link
      href={href}
      className="group rounded-xl border border-gray-200 bg-white p-5 text-left shadow-card transition-all duration-300 hover:shadow-card-hover hover:-translate-y-1 active:scale-[0.98]"
    >
      <div className={`inline-flex items-center justify-center h-10 w-10 rounded-xl ${colors.bg} ${colors.border} border transition-colors duration-200 mb-3`}>
        <span className={colors.icon}>{icon}</span>
      </div>
      <h3 className="text-sm font-semibold text-gray-900 mb-1">{title}</h3>
      <p className="text-xs text-gray-500 leading-relaxed">{description}</p>
      <div className="flex items-center gap-1 mt-3 text-xs font-medium text-gray-400 group-hover:text-primary-600 transition-colors duration-200">
        Explore
        <ArrowRight className="h-3 w-3 transition-transform duration-200 group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}
