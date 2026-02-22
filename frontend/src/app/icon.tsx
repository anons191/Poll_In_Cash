import { ImageResponse } from 'next/og'

export const size = {
  width: 32,
  height: 32,
}
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '6px',
          background: 'linear-gradient(135deg, #1B4D7A 0%, #14B8A6 100%)',
        }}
      >
        <span
          style={{
            color: 'white',
            fontSize: '20px',
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
