import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { App, Form, Input, Modal, Select } from 'antd'
import { useEffect } from 'react'
import { authApi, leadsApi } from '../api/endpoints'
import type { Lead, LeadInput } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { SOURCE_OPTIONS, STATUS_OPTIONS } from '../lib/constants'
import { applyFieldErrors, getErrorMessage } from '../lib/errors'

interface Props {
  open: boolean
  lead?: Lead // present -> edit mode
  onClose: () => void
  onSaved?: (lead: Lead) => void
}

type FormValues = Required<Omit<LeadInput, 'owner_id'>> & { owner_id: number | null }

export function LeadFormModal({ open, lead, onClose, onSaved }: Props) {
  const [form] = Form.useForm<FormValues>()
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const isEdit = !!lead

  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: authApi.users, enabled: open })

  useEffect(() => {
    if (!open) return
    form.resetFields()
    form.setFieldsValue(
      lead
        ? {
            name: lead.name,
            email: lead.email,
            phone: lead.phone,
            source: lead.source,
            status: lead.status,
            note: lead.note,
            owner_id: lead.owner?.id ?? null,
          }
        : { source: 'website', status: 'new', owner_id: user?.id ?? null, email: '', phone: '', note: '' },
    )
  }, [open, lead, form, user])

  const mutation = useMutation({
    mutationFn: (values: FormValues) => (lead ? leadsApi.update(lead.id, values) : leadsApi.create(values)),
    onSuccess: (saved) => {
      message.success(isEdit ? 'Lead updated' : 'Lead created')
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
      queryClient.setQueryData(['lead', saved.id], saved)
      onSaved?.(saved)
      onClose()
    },
    onError: (error) => {
      // Field errors are shown under the inputs; anything else as a toast.
      if (!applyFieldErrors(form, error)) message.error(getErrorMessage(error))
    },
  })

  return (
    <Modal
      open={open}
      title={isEdit ? `Edit lead: ${lead.name}` : 'New lead'}
      okText={isEdit ? 'Save' : 'Create'}
      onOk={() => form.submit()}
      onCancel={onClose}
      confirmLoading={mutation.isPending}
      destroyOnHidden
    >
      <Form<FormValues> form={form} layout="vertical" onFinish={(values) => mutation.mutate(values)}>
        <Form.Item name="name" label="Name" rules={[{ required: true, whitespace: true, min: 2, max: 150 }]}>
          <Input placeholder="Full name or company" />
        </Form.Item>
        <Form.Item
          name="email"
          label="Email"
          dependencies={['phone']}
          rules={[
            { type: 'email', message: 'Enter a valid email' },
            ({ getFieldValue }) => ({
              validator: (_, value) =>
                value || getFieldValue('phone')
                  ? Promise.resolve()
                  : Promise.reject(new Error('Provide an email or a phone number')),
            }),
          ]}
        >
          <Input placeholder="name@example.com" />
        </Form.Item>
        <Form.Item
          name="phone"
          label="Phone"
          rules={[{ pattern: /^\+?[0-9\s\-()]{7,20}$/, message: 'Enter a valid phone number' }]}
        >
          <Input placeholder="+998 90 123 45 67" />
        </Form.Item>
        <Form.Item name="source" label="Source" rules={[{ required: true }]}>
          <Select options={SOURCE_OPTIONS} />
        </Form.Item>
        <Form.Item name="status" label="Status" rules={[{ required: true }]}>
          <Select options={STATUS_OPTIONS} />
        </Form.Item>
        <Form.Item name="owner_id" label="Owner">
          <Select
            allowClear
            showSearch={{ optionFilterProp: 'label' }}
            options={users.map((u) => ({ value: u.id, label: u.full_name }))}
          />
        </Form.Item>
        <Form.Item name="note" label="Note">
          <Input.TextArea rows={3} maxLength={2000} showCount />
        </Form.Item>
      </Form>
    </Modal>
  )
}
