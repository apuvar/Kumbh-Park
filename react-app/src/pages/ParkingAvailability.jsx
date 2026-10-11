import React from "react";
export default function ParkingAvailability({zone,selectedSlot,onSelectSlot}){
  if(!zone) return <section><h2>Parking Availability</h2><p>Select a zone.</p></section>;
  const slots=["A01","A02","A03","A04","A05"];
  return <section><h2>{zone.name} Slots</h2>{slots.map(s=><button key={s} onClick={()=>onSelectSlot(s)}>{s}</button>)}<p>Selected: {selectedSlot||"None"}</p></section>;
}
