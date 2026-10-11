import React from "react";
export default function ReservationForm({vehicleType,setVehicleType,onSubmit}){
  return <section><h2>Reservation</h2>
    <select value={vehicleType} onChange={e=>setVehicleType(e.target.value)}>
      <option value="">Select vehicle</option><option>Car</option><option>Two Wheeler</option><option>Bus</option>
    </select>
    <button onClick={onSubmit}>Reserve</button>
  </section>;
}
