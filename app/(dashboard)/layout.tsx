import Link from 'next/link'
import {
  Inbox,
  Calendar,
  Sparkles,
  Wrench,
  Users,
  DollarSign,
  Database,
  Home,
  BookOpen,
  BarChart2,
  Globe,
  TrendingUp,
} from 'lucide-react'
import { Separator } from '@/components/ui/separator'

const navItems = [
  { href: '/inbox',         label: 'Inbox',           icon: Inbox      },
  { href: '/reservations',  label: 'Réservations',    icon: Calendar   },
  { href: '/properties',    label: 'Logements',       icon: Home       },
  { href: '/menage',        label: 'Ménage',          icon: Sparkles   },
  { href: '/sav',           label: 'SAV',             icon: Wrench     },
  { href: '/proprietaires', label: 'Propriétaires',   icon: Users      },
  { href: '/finance',       label: 'Finance',         icon: DollarSign },
  { href: '/process',       label: 'Process',         icon: BookOpen   },
]

const crmSubItems = [
  { href: '/crm',           label: 'Pipeline',        icon: TrendingUp },
  { href: '/crm#dashboard', label: 'Dashboard & KPIs',icon: BarChart2  },
  { href: '/crm#expansion', label: 'Expansion',       icon: Globe      },
]

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-screen">
      <aside className="w-60 shrink-0 border-r bg-sidebar flex flex-col">
        <div className="px-4 py-5">
          <span className="text-base font-semibold tracking-tight text-sidebar-foreground">
            LCD Tool
          </span>
        </div>
        <Separator />
        <nav className="flex-1 p-2 overflow-y-auto">
          <ul className="space-y-0.5">
            {navItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </Link>
              </li>
            ))}

            {/* CRM — groupe avec sous-items */}
            <li className="pt-1">
              <div className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground">
                <Database className="h-4 w-4 shrink-0" />
                CRM Commercial
              </div>
              <ul className="mt-0.5 ml-4 space-y-0.5 border-l border-border pl-3">
                {crmSubItems.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
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
      </aside>
      <main className="flex-1 overflow-auto bg-background">
        {children}
      </main>
    </div>
  )
}
