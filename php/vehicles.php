<?php
session_start();
if (!isset($_SESSION["admin"])) { header("Location: login.php"); exit; }
require "db.php";
$result=$conn->query("SELECT * FROM vehicles ORDER BY id DESC");
?>
<!DOCTYPE html><html><head><title>Vehicles</title><link rel="stylesheet" href="../style.css"></head><body>
<section class="section"><div class="section-heading"><div><span class="small-title">ADMIN</span><h2>Vehicles</h2><p>3 database read operation.</p></div><a class="secondary-btn" href="dashboard.php">Dashboard</a></div>
<div style="overflow:auto"><table style="width:100%;border-collapse:collapse;background:#fff">
<tr style="background:#edf6f2"><th style="padding:10px">ID</th><th>Vehicle Number</th><th>Type</th><th>Owner</th><th>Mobile</th></tr>
<?php while($v=$result->fetch_assoc()): ?>
<tr><td style="padding:10px"><?php echo $v["id"]; ?></td><td><?php echo htmlspecialchars($v["vehicle_number"]); ?></td><td><?php echo htmlspecialchars($v["vehicle_type"]); ?></td><td><?php echo htmlspecialchars($v["owner_name"]); ?></td><td><?php echo htmlspecialchars($v["mobile"]); ?></td></tr>
<?php endwhile; ?>
</table></div></section></body></html>