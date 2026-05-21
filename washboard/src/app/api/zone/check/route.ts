import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { ZoneConfig } from '@/types'
import { getDeptCodeFromPostal } from '@/lib/france-departments'

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const washerId = searchParams.get('washer_id')
  const address  = searchParams.get('address')

  if (!washerId || !address) return NextResponse.json({ allowed: true })

  const supabase = await createClient()
  const { data: washer } = await supabase
    .from('washers')
    .select('zone_config')
    .eq('id', washerId)
    .single()

  const config = washer?.zone_config as ZoneConfig | null
  if (!config?.enabled) return NextResponse.json({ allowed: true })

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  if (!apiKey) return NextResponse.json({ allowed: true })

  try {
    if (config.type === 'road') {
      const url  = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(config.center_address)}&destinations=${encodeURIComponent(address)}&mode=driving&key=${apiKey}`
      const data = await (await fetch(url)).json()
      const el   = data.rows?.[0]?.elements?.[0]
      // Adresse non reconnue → on laisse passer (adresse peut-être incomplète)
      if (el?.status !== 'OK') return NextResponse.json({ allowed: true })
      const distance_km = Math.round(el.distance.value / 1000)
      return NextResponse.json({ allowed: distance_km <= config.radius_km, distance_km, radius_km: config.radius_km })
    }

    if (config.type === 'crow') {
      let centerLat: number | undefined = config.center_lat
      let centerLng: number | undefined = config.center_lng
      // Coordonnées absentes (géocodage raté à la sauvegarde) → on géocode maintenant
      if (!centerLat || !centerLng) {
        const geoCenter = await (await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(config.center_address)}&key=${apiKey}`)).json()
        const loc = geoCenter.results?.[0]?.geometry?.location
        if (!loc) return NextResponse.json({ allowed: true })
        centerLat = loc.lat as number
        centerLng = loc.lng as number
      }
      if (!centerLat || !centerLng) return NextResponse.json({ allowed: true })
      const url  = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`
      const data = await (await fetch(url)).json()
      const loc  = data.results?.[0]?.geometry?.location
      // Adresse non reconnue → on laisse passer
      if (!loc) return NextResponse.json({ allowed: true })
      const distance_km = Math.round(haversineKm(centerLat, centerLng, loc.lat, loc.lng))
      return NextResponse.json({ allowed: distance_km <= config.radius_km, distance_km, radius_km: config.radius_km })
    }

    if (config.type === 'departments') {
      // On ne vérifie que si l'adresse contient un code postal 5 chiffres — seul signal fiable d'adresse complète
      if (!/\b\d{5}\b/.test(address)) return NextResponse.json({ allowed: true })

      // API adresse du gouvernement français — gratuite, sans clé, retourne le code dept directement
      const url  = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(address)}&limit=1`
      const data = await (await fetch(url)).json()
      const feature = data.features?.[0]
      // Adresse non reconnue → on laisse passer
      if (!feature) return NextResponse.json({ allowed: true })

      // context = "31, Haute-Garonne, Occitanie" → premier élément = code dept
      const context  = (feature.properties?.context as string) ?? ''
      const parts    = context.split(', ')
      const deptCode = parts[0]?.trim()
      const deptName = parts[1]?.trim() ?? deptCode

      if (!deptCode) return NextResponse.json({ allowed: true })
      return NextResponse.json({ allowed: config.departments.includes(deptCode), department: deptCode, department_name: deptName })
    }
  } catch {
    return NextResponse.json({ allowed: true })
  }

  return NextResponse.json({ allowed: true })
}
