import { useNavigate } from "react-router-dom";
import { LockKeyhole, LogOut } from "lucide-react";
import { supabase } from "../lib/supabase";

function Navbar() {
  const navigate = useNavigate();

  async function handleLogout() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      alert(error.message);
      return;
    }

    navigate("/", { replace: true });
  }

  return (
    <nav className="navbar">
      <div className="brand">
        <LockKeyhole size={23} />
        <span>Private Text Vault</span>
      </div>

      <button
        className="logout-button"
        onClick={handleLogout}
      >
        <LogOut size={17} />
        Logout
      </button>
    </nav>
  );
}

export default Navbar;