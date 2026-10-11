<?php
session_start();
if (!isset($_SESSION["admin"])) { header("Location: login.php"); exit; }
require "db.php";
$result=$conn->query("SELECT b.*, p.zone_name FROM bookings b LEFT JOIN parking_zones p ON b.zone_id=p.id ORDER BY b.id DESC");
?>
<!DOCTYPE html><html><head><title>Bookings</title><link rel="stylesheet" href="../style.css"></head><body>
<section class="section"><div class="section-heading"><div><span class="small-title">ADMIN</span><h2>Bookings</h2><p>3 database read operation.</p></div><a class="secondary-btn" href="dashboard.php">Dashboard</a></div>
<div style="overflow:auto"><table style="width:100%;border-collapse:collapse;background:#fff">
<tr style="background:#edf6f2"><th style="padding:10px">ID</th><th>Visitor</th><th>Vehicle</th><th>Zone</th><th>Slot</th><th>Date</th><th>Status</th></tr>
<?php while($b=$result->fetch_assoc()): ?>
<tr><td style="padding:10px"><?php echo $b["id"]; ?></td><td><?php echo htmlspecialchars($b["visitor_name"]); ?></td><td><?php echo htmlspecialchars($b["vehicle_number"]); ?></td><td><?php echo htmlspecialchars($b["zone_name"]); ?></td><td><?php echo htmlspecialchars($b["slot_number"]); ?></td><td><?php echo $b["date"]; ?></td><td><?php echo htmlspecialchars($b["status"]); ?></td></tr>
<?php endwhile; ?>
</table></div></section></body></html>