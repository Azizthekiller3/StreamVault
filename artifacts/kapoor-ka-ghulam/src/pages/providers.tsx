import { useLocation } from "wouter";
import { useEffect } from "react";

export default function Providers() {
  const [, setLocation] = useLocation();
  useEffect(() => { setLocation("/marketplace"); }, [setLocation]);
  return null;
}
