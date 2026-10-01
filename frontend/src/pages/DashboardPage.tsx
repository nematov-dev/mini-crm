import { useQuery } from '@tanstack/react-query'
import { Alert, Card, Col, Row, Skeleton, Statistic } from 'antd'
import dayjs from 'dayjs'
import { useNavigate } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { leadsApi } from '../api/endpoints'
import { getErrorMessage } from '../lib/errors'

// Hex values of the AntD preset colors used by StatusTag, so chart and tags match.
const STATUS_HEX: Record<string, string> = {
  new: '#1677ff',
  contacted: '#faad14',
  qualified: '#722ed1',
  won: '#52c41a',
  lost: '#ff4d4f',
}

export function DashboardPage() {
  const navigate = useNavigate()
  const { data, isLoading, error } = useQuery({ queryKey: ['stats'], queryFn: leadsApi.stats })

  if (error) return <Alert type="error" showIcon title={getErrorMessage(error)} />
  if (isLoading || !data) return <Card><Skeleton active paragraph={{ rows: 8 }} /></Card>

  const open = data.by_status
    .filter((s) => !['won', 'lost'].includes(s.key))
    .reduce((sum, s) => sum + s.count, 0)
  const won = data.by_status.find((s) => s.key === 'won')?.count ?? 0

  return (
    <Row gutter={[16, 16]}>
      {[
        { title: 'Total leads', value: data.total },
        { title: 'New this week', value: data.new_this_week },
        { title: 'Open (in pipeline)', value: open },
        { title: 'Won', value: won },
        { title: 'Win rate', value: data.conversion_rate, suffix: '%' },
      ].map((s) => (
        <Col key={s.title} xs={12} md={8} xl={{ flex: '20%' }}>
          <Card size="small">
            <Statistic title={s.title} value={s.value} suffix={s.suffix} />
          </Card>
        </Col>
      ))}

      <Col xs={24} lg={12}>
        <Card title="Leads by status" size="small">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.by_status} margin={{ left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" />
              <YAxis allowDecimals={false} />
              <Tooltip cursor={{ fillOpacity: 0.1 }} />
              <Bar
                dataKey="count"
                name="Leads"
                radius={[4, 4, 0, 0]}
                style={{ cursor: 'pointer' }}
                onClick={(entry) => navigate(`/leads?status=${(entry.payload as { key: string }).key}`)}
              >
                {data.by_status.map((s) => (
                  <Cell key={s.key} fill={STATUS_HEX[s.key]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </Col>

      <Col xs={24} lg={12}>
        <Card title="Leads by source" size="small">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={[...data.by_source].sort((a, b) => b.count - a.count)} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" allowDecimals={false} />
              <YAxis type="category" dataKey="label" width={90} />
              <Tooltip cursor={{ fillOpacity: 0.1 }} />
              <Bar dataKey="count" name="Leads" fill="#1677ff" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </Col>

      <Col span={24}>
        <Card title="New leads — last 30 days" size="small">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.daily} margin={{ left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tickFormatter={(d) => dayjs(d).format('DD.MM')} minTickGap={16} />
              <YAxis allowDecimals={false} />
              <Tooltip labelFormatter={(d) => dayjs(String(d)).format('DD MMM YYYY')} cursor={{ fillOpacity: 0.1 }} />
              <Bar dataKey="count" name="Leads" fill="#1677ff" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </Col>
    </Row>
  )
}
