import React, {useEffect, useState} from "react";
import ParkingCard from "./components/ParkingCard";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import ParkingZones from "./pages/ParkingZones";
import ParkingAvailability from "./pages/ParkingAvailability";
import ReservationForm from "./pages/ReservationForm";
import BookingConfirmation from "./pages/BookingConfirmation";
import Footer from "./components/Footer";

export default function App(){
  const [zones,setZones]=useState([]);
  const [selectedZone,setSelectedZone]=useState(null);
  const [selectedSlot,setSelectedSlot]=useState("");
  const [vehicleType,setVehicleType]=useState("");
  const [bookingStatus,setBookingStatus]=useState(false);
  const [availableSlots,setAvailableSlots]=useState(0);

  useEffect(()=>{
    setZones([
      {id:1,name:"Zone A – Ramkund",location:"Near Ramkund Ghat",available:245,capacity:400,rate:30},
      {id:2,name:"Zone B – Panchavati",location:"Panchavati Parking Ground",available:182,capacity:350,rate:25}
    ]);
  },[]);

  const chooseZone=(zone)=>{
    setSelectedZone(zone);
    setAvailableSlots(zone.available);
    setSelectedSlot("");
  };

  const reserve=()=>{
    if(selectedZone && selectedSlot && vehicleType) setBookingStatus(true);
  };

  return <div>
    <Navbar/>
    <Home/>
    <ParkingZones zones={zones} onSelect={chooseZone}/>
    <ParkingAvailability zone={selectedZone} selectedSlot={selectedSlot} onSelectSlot={setSelectedSlot}/>
    <ReservationForm vehicleType={vehicleType} setVehicleType={setVehicleType} onSubmit={reserve}/>
    {bookingStatus && <BookingConfirmation zone={selectedZone} slot={selectedSlot}/>}
    <Footer/>
  </div>;
}
