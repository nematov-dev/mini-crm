import { DashboardOutlined, LogoutOutlined, TeamOutlined, UserOutlined } from '@ant-design/icons'
import { Avatar, Button, Dropdown, Flex, Layout, Menu, Typography } from 'antd'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

const { Header, Content } = Layout

export function AppLayout() {
  const { user, logout } = useAuth()
  const { pathname } = useLocation()
  const selected = pathname.startsWith('/leads') ? '/leads' : pathname

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ display: 'flex', alignItems: 'center', gap: 24, paddingInline: 16 }}>
        <Typography.Title level={4} style={{ color: '#fff', margin: 0, whiteSpace: 'nowrap' }}>
          Mini CRM
        </Typography.Title>
        <Menu
          theme="dark"
          mode="horizontal"
          selectedKeys={[selected]}
          style={{ flex: 1, minWidth: 0 }}
          items={[
            { key: '/', icon: <DashboardOutlined />, label: <Link to="/">Dashboard</Link> },
            { key: '/leads', icon: <TeamOutlined />, label: <Link to="/leads">Leads</Link> },
          ]}
        />
        <Dropdown
          menu={{
            items: [{ key: 'logout', icon: <LogoutOutlined />, label: 'Log out', onClick: logout }],
          }}
        >
          <Button type="text" style={{ color: '#fff' }}>
            <Flex gap={8} align="center">
              <Avatar size="small" icon={<UserOutlined />} />
              {user?.full_name}
            </Flex>
          </Button>
        </Dropdown>
      </Header>
      <Content style={{ padding: 16, maxWidth: 1280, width: '100%', margin: '0 auto' }}>
        <Outlet />
      </Content>
    </Layout>
  )
}
