import React from "react";

export default function ParkingCard({zone,onSelect}){
  return <article className="parking-card">
    <div className="parking-content">
      <h3>{zone.name}</h3>
      <p>{zone.location}</p>
      <p>Available: <b>{zone.available}</b> / {zone.capacity}</p>
      <p>Rate: ₹{zone.rate}/hr</p>
      <button onClick={()=>onSelect(zone)}>Select Zone</button>
    </div>
  </article>;
}
