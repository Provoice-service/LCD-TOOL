import Link from 'next/link'
import Image from 'next/image'
import {
  Inbox, Calendar, Sparkles, Wrench, Users, DollarSign,
  Database, Home, BookOpen, BarChart2, Globe, TrendingUp,
  ClipboardList, LogOut, ContactRound, Receipt, FileSignature, BookUser,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

const navItems = [
  { href: '/inbox',         label: 'Inbox',           icon: Inbox        },
  { href: '/agenda',        label: 'Agenda',          icon: ClipboardList },
  { href: '/reservations',  label: 'Réservations',    icon: Calendar     },
  { href: '/contrats',      label: 'Contrats',         icon: FileSignature },
  { href: '/registre',      label: 'Registre',         icon: BookUser      },
  { href: '/properties',   label: 'Logements',        icon: Home         },
  { href: '/menage',        label: 'Ménage',           icon: Sparkles     },
  { href: '/sav',           label: 'SAV',              icon: Wrench       },
  { href: '/contacts',      label: 'Contacts',         icon: ContactRound },
  { href: '/proprietaires', label: 'Propriétaires',   icon: Users        },
  { href: '/finance',       label: 'Finance',          icon: DollarSign   },
  { href: '/process',       label: 'Process',          icon: BookOpen     },
]

const financeSubItems = [
  { href: '/finance/depenses', label: 'Dépenses', icon: Receipt },
]

const crmSubItems = [
  { href: '/crm',           label: 'Pipeline',         icon: TrendingUp  },
  { href: '/crm#dashboard', label: 'Dashboard & KPIs', icon: BarChart2   },
  { href: '/crm#expansion', label: 'Expansion',        icon: Globe       },
]

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { count: urgentCount } = await supabase
    .from('tasks')
    .select('*', { count: 'exact', head: true })
    .eq('priority', 'urgent_important')
    .not('status', 'in', '("done","cancelled")')

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#F8F7F5' }}>

      {/* ── Sidebar ────────────────────────────────────────────────────────── */}
      <aside
        className="w-60 shrink-0 flex flex-col overflow-hidden"
        style={{
          background: '#FFFFFF',
          borderRight: '1px solid #E8E4DC',
        }}
      >
        {/* Logo */}
        <div className="px-6 py-5 shrink-0">
          <Image
            src="/logo-alma-keys.png"
            alt="Alma Keys"
            width={160}
            height={48}
            className="h-12 w-auto object-contain"
            priority
          />
        </div>

        {/* Séparateur or */}
        <div style={{ height: '1px', background: '#E8E4DC', margin: '0 24px' }} />

        {/* Label navigation */}
        <div className="px-6 pt-5 pb-2 shrink-0">
          <span
            className="text-[10px] font-semibold tracking-[0.1em] uppercase"
            style={{ color: '#999999' }}
          >
            Navigation
          </span>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-3 overflow-y-auto pb-4">
          <ul className="space-y-0.5">
            {navItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="group flex items-center gap-3 rounded-r-md px-3 py-2 text-sm font-medium transition-all duration-150"
                  style={{ color: '#666666' }}
                  data-nav-item
                >
                  <item.icon className="h-4 w-4 shrink-0 transition-colors" />
                  <span className="flex-1">{item.label}</span>
                  {item.href === '/agenda' && (urgentCount ?? 0) > 0 && (
                    <span
                      className="text-[10px] rounded-full px-1.5 py-0.5 font-bold leading-none"
                      style={{ background: '#C0392B', color: '#FFFFFF' }}
                    >
                      {urgentCount}
                    </span>
                  )}
                </Link>
              </li>
            ))}

            {/* Finance sub-menu */}
            <li className="pt-1">
              <ul
                className="ml-4 space-y-0.5 pl-3"
                style={{ borderLeft: '1px solid #E8E4DC' }}
              >
                {financeSubItems.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm transition-all duration-150"
                      style={{ color: '#666666' }}
                    >
                      <item.icon className="h-3.5 w-3.5 shrink-0" />
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </li>

            {/* CRM group */}
            <li className="pt-2">
              <div
                className="flex items-center gap-3 px-3 py-1.5 text-[10px] font-semibold tracking-[0.08em] uppercase"
                style={{ color: '#999999' }}
              >
                <Database className="h-3.5 w-3.5 shrink-0" />
                CRM Commercial
              </div>
              <ul
                className="mt-0.5 ml-4 space-y-0.5 pl-3"
                style={{ borderLeft: '1px solid #E8E4DC' }}
              >
                {crmSubItems.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm transition-all duration-150"
                      style={{ color: '#666666' }}
                    >
                      <item.icon className="h-3.5 w-3.5 shrink-0" />
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
          </ul>
        </nav>

        {/* ── User footer ────────────────────────────────────────────────── */}
        <div
          className="shrink-0 px-4 py-4"
          style={{ borderTop: '1px solid #E8E4DC' }}
        >
          <div className="flex items-center gap-3">
            {/* Avatar initiales */}
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
              style={{ background: 'rgba(196,160,68,0.10)', color: '#C4A044', border: '1px solid rgba(196,160,68,0.25)' }}
            >
              MC
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: '#1A1A1A' }}>Morad Chliyah</p>
              <span
                className="text-[10px] font-semibold px-1.5 py-0.5 rounded-sm"
                style={{ background: 'rgba(196,160,68,0.10)', color: '#A88830' }}
              >
                Admin
              </span>
            </div>
            <form action="/api/auth/signout" method="post">
              <button
                type="submit"
                className="p-1.5 rounded-md transition-colors"
                style={{ color: '#999999' }}
                title="Se déconnecter"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* ── Main content ───────────────────────────────────────────────────── */}
      <main
        className="flex-1 overflow-auto"
        style={{ background: '#F8F7F5' }}
      >
        {children}
      </main>
    </div>
  )
}
