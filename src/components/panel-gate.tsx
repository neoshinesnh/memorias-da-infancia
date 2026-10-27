'use client'

import { useState } from 'react'
import { PANEL_UNAVAILABLE, PASSWORD_REJECTED } from '@/components/panel-copy'
import { PanelLock } from '@/components/panel-screen'
import { enterPanelWithPassword, PANEL_ROUTE, type GateResult } from '@/components/panel-transport'

export function PanelGate() {
  const [message, setMessage] = useState<string | null>(null)
  return (
    <PanelLock
      message={message}
      onSubmit={(password) => {
        void sendPassword(password, setMessage)
      }}
    />
  )
}

async function sendPassword(password: string, setMessage: (message: string | null) => void): Promise<void> {
  const result = await enterPanelWithPassword(password)
  if (result === 'accepted') {
    window.location.assign(PANEL_ROUTE)
    return
  }
  setMessage(readGateMessage(result))
}

function readGateMessage(result: Exclude<GateResult, 'accepted'>): string {
  if (result === 'rejected') {
    return PASSWORD_REJECTED
  }
  return PANEL_UNAVAILABLE
}
