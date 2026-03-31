export interface ParsedYouTubeLink {
  videoId: string
  externalUrl: string
  embedUrl: string
  thumbnailUrl: string
}

function buildParsed(videoId: string, externalUrl: string): ParsedYouTubeLink {
  return {
    videoId,
    externalUrl,
    embedUrl: `https://www.youtube.com/embed/${videoId}`,
    thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
  }
}

export function parseYouTubeLink(input: string): ParsedYouTubeLink | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  try {
    const url = new URL(trimmed)
    const host = url.hostname.replace(/^www\./, '')

    if (host === 'youtu.be') {
      const videoId = url.pathname.split('/').filter(Boolean)[0]
      return videoId ? buildParsed(videoId, trimmed) : null
    }

    if (host === 'youtube.com' || host === 'm.youtube.com') {
      if (url.pathname === '/watch') {
        const videoId = url.searchParams.get('v')
        return videoId ? buildParsed(videoId, trimmed) : null
      }

      const parts = url.pathname.split('/').filter(Boolean)
      if (parts[0] === 'shorts' || parts[0] === 'embed') {
        const videoId = parts[1]
        return videoId ? buildParsed(videoId, trimmed) : null
      }
    }
  } catch {
    return null
  }

  return null
}
