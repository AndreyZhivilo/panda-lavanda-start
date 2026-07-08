import { createFileRoute } from '@tanstack/react-router'

import { HomePage } from '#/presentation/pages/home-page'

export const Route = createFileRoute('/')({
  component: HomePage,
})
