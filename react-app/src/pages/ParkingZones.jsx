import React from "react";
import ParkingCard from "../components/ParkingCard";
export default function ParkingZones({zones,onSelect}){return <section><h2>Parking Zones</h2>{zones.map(zone=><ParkingCard key={zone.id} zone={zone} onSelect={onSelect}/>)}</section>;}
