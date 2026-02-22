import { ImageResponse } from 'next/og'

export const size = {
  width: 180,
  height: 180,
}
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '36px',
          background: 'linear-gradient(135deg, #1B4D7A 0%, #14B8A6 100%)',
        }}
      >
        <span
          style={{
            color: 'white',
            fontSize: '110px',
            fontWeight: 700,
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          P
        </span>
      </div>
    ),
    {
      ...size,
    }
  )
}
