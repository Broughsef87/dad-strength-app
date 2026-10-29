import { NextResponse } from 'next/server'
import { CLIENT_DATA_VERSION } from '../../../lib/clientVersion'

export const dynamic = 'force-dynamic'

export function GET() {
  return NextResponse.json({ version: CLIENT_DATA_VERSION }, { headers: { 'Cache-Control': 'no-store' } })
}
