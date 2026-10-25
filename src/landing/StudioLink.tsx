import type { AnchorHTMLAttributes, MouseEvent } from 'react'

export function StudioLink(props: AnchorHTMLAttributes<HTMLAnchorElement>) {
  const enter = (event: MouseEvent<HTMLAnchorElement>) => {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return
    event.preventDefault()
    const navigate = () => {
      window.history.pushState(null, '', props.href ?? '/studio')
      window.dispatchEvent(new PopStateEvent('popstate'))
      window.scrollTo(0, 0)
    }
    const documentWithTransition = document as Document & {
      startViewTransition?: (update: () => void) => unknown
    }
    if (
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches &&
      documentWithTransition.startViewTransition
    )
      documentWithTransition.startViewTransition(navigate)
    else navigate()
  }
  return <a {...props} onClick={enter} />
}
