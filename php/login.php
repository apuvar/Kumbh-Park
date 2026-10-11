<?php
session_start();
if(isset($_SESSION["admin"])){header("Location: dashboard.php");exit;}
$message="";
if($_SERVER["REQUEST_METHOD"]==="POST"){
  $username=strtolower(trim($_POST["username"]??""));$password=trim($_POST["password"]??"");
  if($username==="admin"&&$password==="admin123"){$_SESSION["admin"]="admin";header("Location: dashboard.php");exit;}
  $message="Invalid username or password.";
}
?>
<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Admin Login | KumbhPark</title><link rel="stylesheet" href="../style.css"></head>
<body><div class="auth-wrap"><section class="auth-card"><h1>Admin Login</h1><p>Manage the parking system.</p><?php if($message): ?><div class="message error"><?php echo htmlspecialchars($message); ?></div><?php endif; ?><form method="POST"><div class="form-group"><label>Username</label><input name="username" required></div><div class="form-group"><label>Password</label><input name="password" type="password" required></div><button class="form-submit">Login</button></form></section></div></body></html>