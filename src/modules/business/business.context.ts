import type { BusinessProfileRecord } from './business.repository.js'

function optionalLine(label: string, value: string | null | undefined): string | null {
  if (value === null || value === undefined || value.trim().length === 0) {
    return null
  }

  return `${label}: ${value.trim()}`
}

export function buildBusinessContextLines(profile: BusinessProfileRecord | null): string[] {
  if (profile === null) {
    return []
  }

  const lines = [
    optionalLine('Brand', profile.brand_name),
    optionalLine('Website', profile.website_url),
    optionalLine('Facebook page', profile.facebook_page_url),
    optionalLine('Instagram page', profile.instagram_page_url),
    optionalLine('About the business', profile.business_description),
  ].filter((line): line is string => line !== null)

  if (profile.catalogue_files.length > 0) {
    const catalogueNames = profile.catalogue_files.map((file) => file.filename).join(', ')
    lines.push(`Catalogue documents on file: ${catalogueNames}`)
  }

  return lines
}
