import { PlusOutlined } from '@ant-design/icons'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Alert, Button, Card, Flex, Input, Select, Table, Typography } from 'antd'
import type { ColumnsType, SorterResult } from 'antd/es/table/interface'
import dayjs from 'dayjs'
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { leadsApi } from '../api/endpoints'
import type { Lead, LeadListParams, LeadSource, LeadStatus } from '../api/types'
import { LeadFormModal } from '../components/LeadFormModal'
import { StatusTag } from '../components/StatusTag'
import { DATE_FORMAT, SOURCE_OPTIONS, STATUS_OPTIONS } from '../lib/constants'
import { getErrorMessage } from '../lib/errors'

const SORTABLE = ['name', 'status', 'created_at', 'updated_at'] as const

/** All list state lives in the URL, so it survives reloads and can be shared. */
function useListParams() {
  const [searchParams, setSearchParams] = useSearchParams()

  const params: LeadListParams = {
    page: Number(searchParams.get('page') ?? 1),
    page_size: Number(searchParams.get('page_size') ?? 10),
    search: searchParams.get('search') ?? undefined,
    status: searchParams.getAll('status') as LeadStatus[],
    source: searchParams.getAll('source') as LeadSource[],
    ordering: searchParams.get('ordering') ?? '-created_at',
  }

  const update = (patch: Partial<LeadListParams>, resetPage = true) => {
    const next = { ...params, ...(resetPage ? { page: 1 } : {}), ...patch }
    const sp = new URLSearchParams()
    Object.entries(next).forEach(([key, value]) => {
      if (Array.isArray(value)) value.forEach((v) => sp.append(key, v))
      else if (value !== undefined && value !== '' && value !== null) sp.set(key, String(value))
    })
    setSearchParams(sp, { replace: true })
  }

  return { params, update }
}

export function LeadsPage() {
  const navigate = useNavigate()
  const { params, update } = useListParams()
  const [createOpen, setCreateOpen] = useState(false)

  const { data, isFetching, error } = useQuery({
    queryKey: ['leads', params],
    queryFn: () => leadsApi.list(params),
    placeholderData: keepPreviousData,
  })

  const sortOrder = (field: string) =>
    params.ordering === field ? 'ascend' : params.ordering === `-${field}` ? 'descend' : null

  const columns: ColumnsType<Lead> = [
    {
      title: 'Name',
      dataIndex: 'name',
      sorter: true,
      sortOrder: sortOrder('name'),
      render: (name, lead) => <Link to={`/leads/${lead.id}`}>{name}</Link>,
    },
    {
      title: 'Contact',
      key: 'contact',
      render: (_, lead) => (
        <Flex vertical>
          {lead.phone && <span>{lead.phone}</span>}
          {lead.email && <Typography.Text type="secondary">{lead.email}</Typography.Text>}
        </Flex>
      ),
    },
    { title: 'Source', dataIndex: 'source_display', responsive: ['md'] },
    {
      title: 'Status',
      dataIndex: 'status',
      sorter: true,
      sortOrder: sortOrder('status'),
      render: (status) => <StatusTag status={status} />,
    },
    { title: 'Owner', dataIndex: ['owner', 'full_name'], responsive: ['lg'], render: (v) => v ?? '—' },
    {
      title: 'Created',
      dataIndex: 'created_at',
      sorter: true,
      sortOrder: sortOrder('created_at'),
      responsive: ['sm'],
      render: (v) => dayjs(v).format(DATE_FORMAT),
    },
  ]

  return (
    <Card
      title="Leads"
      extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
          New lead
        </Button>
      }
    >
      <Flex gap={8} wrap style={{ marginBottom: 16 }}>
        <Input.Search
          key={params.search ?? ''} // reset the input when the URL changes from outside
          allowClear
          placeholder="Search name, email or phone"
          defaultValue={params.search}
          onSearch={(value) => update({ search: value.trim() || undefined })}
          style={{ width: 280, maxWidth: '100%' }}
        />
        <Select
          mode="multiple"
          allowClear
          placeholder="Status"
          options={STATUS_OPTIONS}
          value={params.status}
          onChange={(status) => update({ status })}
          style={{ minWidth: 180 }}
        />
        <Select
          mode="multiple"
          allowClear
          placeholder="Source"
          options={SOURCE_OPTIONS}
          value={params.source}
          onChange={(source) => update({ source })}
          style={{ minWidth: 180 }}
        />
      </Flex>

      {error && <Alert type="error" showIcon title={getErrorMessage(error)} style={{ marginBottom: 16 }} />}

      <Table<Lead>
        rowKey="id"
        columns={columns}
        dataSource={data?.results}
        loading={isFetching}
        scroll={{ x: 'max-content' }}
        onRow={(lead) => ({ onDoubleClick: () => navigate(`/leads/${lead.id}`) })}
        pagination={{
          current: params.page,
          pageSize: params.page_size,
          total: data?.count ?? 0,
          showSizeChanger: true,
          showTotal: (total) => `${total} leads`,
        }}
        onChange={(pagination, _filters, sorter, extra) => {
          if (extra.action === 'paginate') {
            update({ page: pagination.current, page_size: pagination.pageSize }, false)
          } else if (extra.action === 'sort') {
            const s = sorter as SorterResult<Lead>
            const field = String(s.field ?? '')
            const ordering =
              s.order && (SORTABLE as readonly string[]).includes(field)
                ? `${s.order === 'descend' ? '-' : ''}${field}`
                : undefined
            update({ ordering })
          }
        }}
      />

      <LeadFormModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSaved={(lead) => navigate(`/leads/${lead.id}`)}
      />
    </Card>
  )
}
