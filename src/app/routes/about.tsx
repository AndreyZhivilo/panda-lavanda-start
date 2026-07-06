import { createFileRoute } from '@tanstack/react-router'

import { AboutPage } from '@presentation/pages/about-page'

export const Route = createFileRoute('/about')({
  component: AboutPage,
})
