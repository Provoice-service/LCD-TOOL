import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { MessageSquare, Calendar, AlertTriangle, Home } from 'lucide-react'

const metrics = [
  { title: 'Messages non lus', icon: MessageSquare },
  { title: 'Réservations du jour', icon: Calendar },
  { title: 'Incidents ouverts', icon: AlertTriangle },
  { title: 'Logements actifs', icon: Home },
]

export default function DashboardPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-6">Tableau de bord</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((metric) => (
          <Card key={metric.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {metric.title}
              </CardTitle>
              <metric.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">0</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
