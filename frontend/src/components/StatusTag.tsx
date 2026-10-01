import { Tag } from 'antd'
import { statusMeta } from '../lib/constants'

export function StatusTag({ status }: { status: string }) {
  const meta = statusMeta(status)
  return <Tag color={meta.color}>{meta.label}</Tag>
}
