'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { 
  Mail, 
  Watch, 
  Send, 
  Twitter, 
  TrendingUp, 
  Activity, 
  MessageCircle,
  Heart
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface MetricCardProps {
  title: string
  value: string
  subtitle?: string
  icon: React.ElementType
  trend?: 'up' | 'down' | 'neutral'
  className?: string
}

function MetricCard({ title, value, subtitle, icon: Icon, trend, className }: MetricCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'p-5 rounded-xl border border-border bg-card dark:bg-zinc-900/50',
        'hover:border-zinc-300 dark:hover:border-zinc-700',
        'transition-colors duration-150',
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-2xl font-semibold mt-1">{value}</p>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
          )}
        </div>
        <div className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
      </div>
      {trend && (
        <div className="flex items-center gap-1 mt-3">
          <TrendingUp className={cn(
            'h-3.5 w-3.5',
            trend === 'up' ? 'text-emerald-500' : trend === 'down' ? 'text-red-500' : 'text-muted-foreground'
          )} />
          <span className={cn(
            'text-xs',
            trend === 'up' ? 'text-emerald-500' : trend === 'down' ? 'text-red-500' : 'text-muted-foreground'
          )}>
            {trend === 'up' ? '+12%' : trend === 'down' ? '-5%' : '0%'} за неделю
          </span>
        </div>
      )}
    </motion.div>
  )
}

interface ServiceCardProps {
  name: string
  status: 'connected' | 'disconnected'
  lastSync?: string
  icon: React.ElementType
  color: string
  className?: string
}

function ServiceCard({ name, status, lastSync, icon: Icon, color, className }: ServiceCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'p-5 rounded-xl border border-border bg-card dark:bg-zinc-900/50',
        'hover:border-zinc-300 dark:hover:border-zinc-700',
        'transition-colors duration-150 cursor-pointer',
        className
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={cn('p-2.5 rounded-xl', color)}>
            <Icon className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="font-medium text-sm">{name}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {status === 'connected' ? `Синхр.: ${lastSync}` : 'Не подключено'}
            </p>
          </div>
        </div>
        <div className={cn(
          'h-2 w-2 rounded-full',
          status === 'connected' ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-600'
        )} />
      </div>
    </motion.div>
  )
}

export function DashboardView() {
  return (
    <div className="h-full min-h-0 overflow-y-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Дашборд</h1>
        <p className="text-muted-foreground mt-1">Обзор подключённых сервисов и активности</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <MetricCard
          title="Письма"
          value="247"
          subtitle="12 непрочитанных"
          icon={Mail}
          trend="up"
        />
        <MetricCard
          title="Шаги"
          value="8,432"
          subtitle="Цель: 10,000"
          icon={Watch}
          trend="up"
        />
        <MetricCard
          title="Сообщения"
          value="89"
          subtitle="3 непрочитанных"
          icon={MessageCircle}
          trend="neutral"
        />
        <MetricCard
          title="Посты X"
          value="1,247"
          subtitle="ER: 4.2%"
          icon={Twitter}
          trend="down"
        />
      </div>

      {/* Connected Services */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4">Подключённые сервисы</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ServiceCard
            name="Gmail"
            status="connected"
            lastSync="2 мин назад"
            icon={Mail}
            color="bg-red-500"
          />
          <ServiceCard
            name="Fitbit"
            status="connected"
            lastSync="5 мин назад"
            icon={Watch}
            color="bg-cyan-500"
          />
          <ServiceCard
            name="Telegram"
            status="connected"
            lastSync="1 мин назад"
            icon={Send}
            color="bg-blue-500"
          />
          <ServiceCard
            name="X (Twitter)"
            status="disconnected"
            icon={Twitter}
            color="bg-zinc-400"
          />
        </div>
      </div>

      {/* Recent Activity */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Последняя активность</h2>
        <div className="rounded-xl border border-border bg-card dark:bg-zinc-900/50 divide-y divide-border">
          {[
            {title: 'Новое письмо от John Doe', time: '5 мин назад', icon: Mail },
            { title: 'Цель по шагам достигнута', time: '1 час назад', icon: Activity },
            { title: 'Новое сообщение в проекте Alpha', time: '2 часа назад', icon: MessageCircle },
            { title: 'Пост лайкнул @techguru', time: '3 часа назад', icon: Heart },
          ].map((item, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="flex items-center gap-3 p-4"
            >
              <item.icon className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1 text-sm">{item.title}</span>
              <span className="text-xs text-muted-foreground">{item.time}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}
