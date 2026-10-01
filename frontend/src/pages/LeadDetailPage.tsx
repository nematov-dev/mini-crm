import { ArrowLeftOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Flex,
  Popconfirm,
  Result,
  Row,
  Segmented,
  Skeleton,
  Timeline,
  Typography,
} from 'antd'
import { isAxiosError } from 'axios'
import dayjs from 'dayjs'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { leadsApi } from '../api/endpoints'
import type { LeadActivity, LeadStatus } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { LeadFormModal } from '../components/LeadFormModal'
import { StatusTag } from '../components/StatusTag'
import { DATE_FORMAT, STATUS_OPTIONS, sourceLabel, statusMeta } from '../lib/constants'
import { getErrorMessage } from '../lib/errors'

const FIELD_LABELS: Record<string, string> = {
  name: 'Name',
  email: 'Email',
  phone: 'Phone',
  source: 'Source',
  status: 'Status',
  note: 'Note',
  owner: 'Owner',
}

function formatValue(field: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (field === 'status') return statusMeta(String(value)).label
  if (field === 'source') return sourceLabel(String(value))
  return String(value)
}

function ActivityItem({ activity }: { activity: LeadActivity }) {
  const who = activity.actor?.full_name ?? 'System'
  const when = dayjs(activity.created_at).format(DATE_FORMAT)

  let body
  if (activity.action === 'created') {
    body = <>created the lead</>
  } else if (activity.action === 'status_changed') {
    const { from, to } = activity.changes.status
    body = (
      <>
        changed status <StatusTag status={String(from)} /> → <StatusTag status={String(to)} />
      </>
    )
  } else {
    body = (
      <>
        updated
        <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
          {Object.entries(activity.changes).map(([field, { from, to }]) => (
            <li key={field}>
              <b>{FIELD_LABELS[field] ?? field}</b>: {formatValue(field, from)} → {formatValue(field, to)}
            </li>
          ))}
        </ul>
      </>
    )
  }

  return (
    <div>
      <Typography.Text strong>{who}</Typography.Text> {body}
      <div>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {when}
        </Typography.Text>
      </div>
    </div>
  )
}

export function LeadDetailPage() {
  const id = Number(useParams().id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { message } = App.useApp()
  const { user } = useAuth()
  const [editOpen, setEditOpen] = useState(false)

  const leadQuery = useQuery({ queryKey: ['lead', id], queryFn: () => leadsApi.get(id) })
  const activityQuery = useQuery({
    queryKey: ['lead', id, 'activities'],
    queryFn: () => leadsApi.activities(id),
    enabled: leadQuery.isSuccess,
  })

  const refreshRelated = () => {
    queryClient.invalidateQueries({ queryKey: ['leads'] })
    queryClient.invalidateQueries({ queryKey: ['stats'] })
    queryClient.invalidateQueries({ queryKey: ['lead', id, 'activities'] })
  }

  const statusMutation = useMutation({
    mutationFn: (status: LeadStatus) => leadsApi.changeStatus(id, status),
    onSuccess: (lead) => {
      queryClient.setQueryData(['lead', id], lead)
      refreshRelated()
      message.success(`Status changed to ${lead.status_display}`)
    },
    onError: (error) => message.error(getErrorMessage(error)),
  })

  const deleteMutation = useMutation({
    mutationFn: () => leadsApi.remove(id),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ['lead', id] })
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
      message.success('Lead deleted')
      navigate('/leads')
    },
    onError: (error) => message.error(getErrorMessage(error)),
  })

  if (leadQuery.isLoading) return <Card><Skeleton active /></Card>

  if (leadQuery.error) {
    const notFound = isAxiosError(leadQuery.error) && leadQuery.error.response?.status === 404
    return (
      <Result
        status={notFound ? '404' : 'error'}
        title={notFound ? 'Lead not found' : 'Could not load lead'}
        subTitle={notFound ? undefined : getErrorMessage(leadQuery.error)}
        extra={<Button onClick={() => navigate('/leads')}>Back to leads</Button>}
      />
    )
  }

  const lead = leadQuery.data!
  const canDelete = !!user && (user.is_staff || lead.owner?.id === user.id)

  return (
    <Flex vertical gap={16}>
      <Link to="/leads">
        <ArrowLeftOutlined /> All leads
      </Link>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={15}>
          <Card
            title={
              <Flex gap={8} align="center" wrap>
                {lead.name} <StatusTag status={lead.status} />
              </Flex>
            }
            extra={
              <Flex gap={8}>
                <Button icon={<EditOutlined />} onClick={() => setEditOpen(true)}>
                  Edit
                </Button>
                {canDelete && (
                  <Popconfirm
                    title="Delete this lead?"
                    description="This cannot be undone."
                    okText="Delete"
                    okButtonProps={{ danger: true }}
                    onConfirm={() => deleteMutation.mutate()}
                  >
                    <Button danger icon={<DeleteOutlined />} loading={deleteMutation.isPending} />
                  </Popconfirm>
                )}
              </Flex>
            }
          >
            <Typography.Text type="secondary">Status</Typography.Text>
            <div style={{ overflowX: 'auto', margin: '8px 0 24px' }}>
              <Segmented<LeadStatus>
                value={lead.status}
                disabled={statusMutation.isPending}
                options={STATUS_OPTIONS.map((s) => ({ value: s.value, label: s.label }))}
                onChange={(status) => statusMutation.mutate(status)}
              />
            </div>

            <Descriptions column={{ xs: 1, sm: 2 }} bordered size="small">
              <Descriptions.Item label="Phone">{lead.phone || '—'}</Descriptions.Item>
              <Descriptions.Item label="Email">
                {lead.email ? <a href={`mailto:${lead.email}`}>{lead.email}</a> : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Source">{lead.source_display}</Descriptions.Item>
              <Descriptions.Item label="Owner">{lead.owner?.full_name ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="Created">{dayjs(lead.created_at).format(DATE_FORMAT)}</Descriptions.Item>
              <Descriptions.Item label="Updated">{dayjs(lead.updated_at).format(DATE_FORMAT)}</Descriptions.Item>
              <Descriptions.Item label="Note" span={2}>
                <Typography.Paragraph style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
                  {lead.note || '—'}
                </Typography.Paragraph>
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        <Col xs={24} lg={9}>
          <Card title="Activity">
            {activityQuery.error && <Alert type="error" title={getErrorMessage(activityQuery.error)} />}
            {activityQuery.isLoading && <Skeleton active />}
            {activityQuery.data?.results.length === 0 && <Empty />}
            {activityQuery.data && (
              <Timeline
                items={activityQuery.data.results.map((a) => ({
                  key: a.id,
                  color: a.action === 'status_changed' ? statusMeta(String(a.changes.status?.to)).color : 'gray',
                  content: <ActivityItem activity={a} />,
                }))}
              />
            )}
          </Card>
        </Col>
      </Row>

      <LeadFormModal
        open={editOpen}
        lead={lead}
        onClose={() => setEditOpen(false)}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ['lead', id, 'activities'] })}
      />
    </Flex>
  )
}
