import React from 'react'

export default function ZoomButtons({ zoomIn, zoomOut }) {
  return (
    <div className="zoom-buttons">
      <button onClick={zoomIn}>+</button>
      <button onClick={zoomOut}>-</button>
    </div>
  )
}
