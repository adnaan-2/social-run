import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Footprints,
  User,
  LogOut,
  Flame,
  MapPin,
  Activity,
  Trophy,
  ChevronDown,
  Play,
  Pause,
  Square,
  Users,
  Check,
  X,
  Send,
  Award,
  Sparkles,
  Compass,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import L from 'leaflet';

// Fix for default Leaflet marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Helper function to calculate distance between two coordinates in meters
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // metres
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // in meters
}

export default function Dashboard() {
  const { user, setUser, logout, socket } = useAuth();
  const navigate = useNavigate();

  // Dropdown UI state
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Social state
  const [nearbyWalkers, setNearbyWalkers] = useState([]);
  const [pendingRequests, setPendingRequests] = useState({ incoming: [], outgoing: [] });
  const [followingList, setFollowingList] = useState([]);
  const [activeTab, setActiveTab] = useState('nearby'); // 'nearby' | 'following' | 'invites'

  // Walk Session state
  const [isWalking, setIsWalking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [walkSession, setWalkSession] = useState(null);
  const [duration, setDuration] = useState(0); // in seconds
  const [distance, setDistance] = useState(0); // in meters
  const [coordinates, setCoordinates] = useState([]); // Array of {lat, lng, timestamp}
  const [isBuddyWalk, setIsBuddyWalk] = useState(false);
  const [buddyUser, setBuddyUser] = useState(null);

  // Simulated walking state
  const [isSimulating, setIsSimulating] = useState(false);
  const simulationInterval = useRef(null);

  // Walk completion celebration state
  const [showCelebration, setShowCelebration] = useState(false);
  const [completionSummary, setCompletionSummary] = useState(null);

  // History state
  const [walkHistory, setWalkHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  // Leaflet Map Refs
  const mapContainerRef = useRef(null);
  const activeMapContainerRef = useRef(null);
  const mainMap = useRef(null);
  const activeWalkMap = useRef(null);
  const userMarker = useRef(null);
  const buddyMarker = useRef(null);
  const routePolyline = useRef(null);
  const nearbyMarkers = useRef(new Map()); // userId -> marker

  // Watch position ID
  const watchId = useRef(null);
  const timerInterval = useRef(null);

  // User location cache
  const [userLocation, setUserLocation] = useState(null);

  // Click outside dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch initial dashboard data
  useEffect(() => {
    fetchHistory();
    fetchSocialData();
    getCurrentLocation();

    // Set up periodic refresh for nearby walkers
    const interval = setInterval(() => {
      if (userLocation) {
        fetchNearbyWalkers(userLocation.lng, userLocation.lat);
      }
    }, 15000);

    return () => {
      clearInterval(interval);
      if (watchId.current) navigator.geolocation.clearWatch(watchId.current);
      if (timerInterval.current) clearInterval(timerInterval.current);
      if (simulationInterval.current) clearInterval(simulationInterval.current);
    };
  }, []);

  // Set up socket listeners
  useEffect(() => {
    if (!socket) return;

    socket.on('location_updated', (data) => {
      const { userId, lat, lng } = data;
      // Update nearby walkers state
      setNearbyWalkers((prev) =>
        prev.map((w) => {
          if (w._id === userId) {
            return {
              ...w,
              currentLocation: { type: 'Point', coordinates: [lng, lat] },
            };
          }
          return w;
        })
      );

      // Update map marker if main map is loaded
      if (mainMap.current && nearbyMarkers.current.has(userId)) {
        const marker = nearbyMarkers.current.get(userId);
        marker.setLatLng([lat, lng]);
      }
    });

    socket.on('user_online', (data) => {
      if (userLocation) {
        fetchNearbyWalkers(userLocation.lng, userLocation.lat);
      }
    });

    socket.on('user_offline', (data) => {
      const { userId } = data;
      setNearbyWalkers((prev) => prev.filter((w) => w._id !== userId));
      if (mainMap.current && nearbyMarkers.current.has(userId)) {
        const marker = nearbyMarkers.current.get(userId);
        marker.remove();
        nearbyMarkers.current.delete(userId);
      }
    });

    socket.on('walk_request_received', (data) => {
      // Refresh invites
      fetchSocialData();
      // Visual notification could go here, but tab highlights suffice
    });

    socket.on('walk_request_responded', (data) => {
      const { requestId, receiverId, status } = data;
      fetchSocialData();

      if (status === 'accepted') {
        // Find the user info
        api.get('/social/requests').then((res) => {
          const matchingRequest = res.data.incoming
            .concat(res.data.outgoing)
            .find((r) => r._id === requestId || (r.senderId._id === receiverId && r.status === 'accepted'));

          const partner =
            matchingRequest?.receiverId._id === receiverId
              ? matchingRequest.receiverId
              : matchingRequest?.senderId;

          if (partner) {
            // Start Buddy Walk
            initiateWalk(true, partner);
          }
        });
      }
    });

    // Buddy coordinate stream
    socket.on('buddy_location_stream', (data) => {
      const { lat, lng, speed, timestamp } = data;
      if (activeWalkMap.current) {
        if (!buddyMarker.current) {
          const buddyIcon = L.divIcon({
            html: `<div style="width: 16px; height: 16px; border-radius: 50%; background: var(--accent-secondary); border: 2px solid white; box-shadow: 0 0 10px var(--accent-secondary);"></div>`,
            className: 'buddy-location-icon',
          });
          buddyMarker.current = L.marker([lat, lng], { icon: buddyIcon }).addTo(activeWalkMap.current);
        } else {
          buddyMarker.current.setLatLng([lat, lng]);
        }
      }
    });

    // Notify other users on connection/reconnection
    if (userLocation) {
      socket.emit('update_location', { lat: userLocation.lat, lng: userLocation.lng });
    }

    return () => {
      socket.off('location_updated');
      socket.off('user_online');
      socket.off('user_offline');
      socket.off('walk_request_received');
      socket.off('walk_request_responded');
      socket.off('buddy_location_stream');
    };
  }, [socket, userLocation]);

  // Load Main Map once container is rendered & user location is available
  useEffect(() => {
    if (!mapContainerRef.current || isWalking) return;

    if (!mainMap.current) {
      // Default to [0,0], we will pan to user location shortly
      mainMap.current = L.map(mapContainerRef.current, {
        zoomControl: false,
      }).setView([0, 0], 2);

      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 20,
      }).addTo(mainMap.current);

      // Add Zoom Control at bottom right
      L.control.zoom({ position: 'bottomright' }).addTo(mainMap.current);
    }

    if (userLocation && mainMap.current) {
      mainMap.current.setView([userLocation.lat, userLocation.lng], 14);

      if (!userMarker.current) {
        const userIcon = L.divIcon({
          html: `<div style="width: 20px; height: 20px; border-radius: 50%; background: var(--accent-primary); border: 3px solid white; box-shadow: 0 0 15px var(--accent-primary); animation: pulse-glow 2s infinite;"></div>`,
          className: 'user-location-icon',
        });
        userMarker.current = L.marker([userLocation.lat, userLocation.lng], { icon: userIcon }).addTo(
          mainMap.current
        );
      } else {
        userMarker.current.setLatLng([userLocation.lat, userLocation.lng]);
      }
    }

    // Render nearby walker pins
    renderNearbyWalkersOnMap();
  }, [mapContainerRef, userLocation, nearbyWalkers, isWalking]);

  // Load Active Walk Map
  useEffect(() => {
    if (!activeMapContainerRef.current || !isWalking) return;

    if (!activeWalkMap.current) {
      activeWalkMap.current = L.map(activeMapContainerRef.current, {
        zoomControl: false,
      }).setView(
        userLocation ? [userLocation.lat, userLocation.lng] : [0, 0],
        16
      );

      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        subdomains: 'abcd',
        maxZoom: 20,
      }).addTo(activeWalkMap.current);

      routePolyline.current = L.polyline([], {
        color: 'var(--accent-primary)',
        weight: 6,
        opacity: 0.9,
      }).addTo(activeWalkMap.current);
    }
  }, [activeMapContainerRef, isWalking]);

  // Render nearby markers helper
  const renderNearbyWalkersOnMap = () => {
    if (!mainMap.current) return;

    // Remove obsolete markers
    const walkerIds = new Set(nearbyWalkers.map((w) => w._id));
    for (const [uid, marker] of nearbyMarkers.current.entries()) {
      if (!walkerIds.has(uid)) {
        marker.remove();
        nearbyMarkers.current.delete(uid);
      }
    }

    // Add/Update markers
    nearbyWalkers.forEach((w) => {
      const coords = w.currentLocation?.coordinates;
      if (!coords || coords.length < 2 || (coords[0] === 0 && coords[1] === 0)) return;

      const lat = coords[1];
      const lng = coords[0];

      if (nearbyMarkers.current.has(w._id)) {
        nearbyMarkers.current.get(w._id).setLatLng([lat, lng]);
      } else {
        const divIcon = L.divIcon({
          html: `<div style="width: 14px; height: 14px; border-radius: 50%; background: var(--accent-secondary); border: 2px solid white; box-shadow: 0 0 10px var(--accent-secondary);"></div>`,
          className: 'nearby-walker-icon',
        });
        const marker = L.marker([lat, lng], { icon: divIcon })
          .addTo(mainMap.current)
          .bindPopup(
            `<div style="color: white; font-family: inherit; font-size: 13px; font-weight: 600;">${w.username}</div><div style="font-size: 11px; color: #8888a0;">Level ${w.level} • Streak: ${w.currentStreak}d</div>`
          );
        nearbyMarkers.current.set(w._id, marker);
      }
    });
  };

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const loc = { lat: position.coords.latitude, lng: position.coords.longitude };
          setUserLocation(loc);
          // Fetch nearby users once location is available
          fetchNearbyWalkers(loc.lng, loc.lat);
          // Emit socket location update
          if (socket) {
            socket.emit('update_location', { lat: loc.lat, lng: loc.lng });
          }
        },
        (error) => {
          console.warn('Geolocation access failed. Using default location.');
          const defaultLoc = { lat: 40.7128, lng: -74.006 }; // New York
          setUserLocation(defaultLoc);
        }
      );
    }
  };

  const fetchHistory = async () => {
    try {
      setHistoryLoading(true);
      const res = await api.get('/walks/history');
      setWalkHistory(res.data.walks);
    } catch (err) {
      console.error(err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const fetchSocialData = async () => {
    try {
      const requestsRes = await api.get('/social/requests');
      setPendingRequests({
        incoming: requestsRes.data.incoming,
        outgoing: requestsRes.data.outgoing,
      });

      const followingRes = await api.get('/social/following');
      setFollowingList(followingRes.data.following);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchNearbyWalkers = async (lng, lat) => {
    try {
      const res = await api.get(`/social/nearby?lng=${lng}&lat=${lat}`);
      setNearbyWalkers(res.data.walkers);
    } catch (err) {
      console.error(err);
    }
  };

  // Follow/Unfollow user
  const handleFollowToggle = async (walker) => {
    try {
      if (walker.isFollowing) {
        await api.post(`/social/unfollow/${walker._id}`);
      } else {
        await api.post(`/social/follow/${walker._id}`);
      }
      // Update state
      setNearbyWalkers((prev) =>
        prev.map((w) => (w._id === walker._id ? { ...w, isFollowing: !w.isFollowing } : w))
      );
      fetchSocialData();
    } catch (err) {
      console.error(err);
    }
  };

  // Send walk invite
  const handleInviteToWalk = async (walkerId) => {
    try {
      const res = await api.post('/social/requests', { receiverId: walkerId });
      // Emit socket notification
      if (socket) {
        socket.emit('send_walk_request', {
          receiverId: walkerId,
          requestId: res.data.request._id,
          senderUsername: user.username,
        });
      }
      fetchSocialData();
    } catch (err) {
      console.error(err);
    }
  };

  // Respond to request
  const handleRespondRequest = async (requestId, senderId, status) => {
    try {
      await api.post(`/social/requests/${requestId}/respond`, { status });
      if (socket) {
        socket.emit('respond_walk_request', {
          requestId,
          senderId,
          status,
        });
      }
      fetchSocialData();
    } catch (err) {
      console.error(err);
    }
  };

  // Start walk session
  const initiateWalk = async (buddyMode = false, buddy = null) => {
    try {
      setIsWalking(true);
      setIsPaused(false);
      setDuration(0);
      setDistance(0);
      setCoordinates([]);
      setIsBuddyWalk(buddyMode);
      setBuddyUser(buddy);

      // Call API to start session
      const startRes = await api.post('/walks/start', {
        startTime: new Date(),
        isBuddyWalk: buddyMode,
        buddyUserId: buddy ? buddy._id : undefined,
      });
      setWalkSession(startRes.data.walkSession);

      // Notify buddy via Socket
      if (buddyMode && buddy && socket) {
        socket.emit('buddy_walk_start', {
          buddyId: buddy._id,
          walkSessionId: startRes.data.walkSession._id,
        });
      }

      // Initialize local trace with current location
      let initialCoords = [];
      if (userLocation) {
        initialCoords.push({ lat: userLocation.lat, lng: userLocation.lng, timestamp: new Date() });
        setCoordinates(initialCoords);
      }

      // Start timer
      timerInterval.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);

      // Start Geolocation watch
      if (navigator.geolocation && !isSimulating) {
        watchId.current = navigator.geolocation.watchPosition(
          (position) => {
            const { latitude, longitude, speed } = position.coords;
            const newCoord = {
              lat: latitude,
              lng: longitude,
              timestamp: new Date(),
              speed: speed || 0,
            };

            setCoordinates((prev) => {
              const last = prev[prev.length - 1];
              let updated = [...prev];

              // Check if moved
              if (last) {
                const distIncrement = getDistance(last.lat, last.lng, latitude, longitude);
                if (distIncrement > 1.5) {
                  setDistance((d) => d + distIncrement);
                  updated.push(newCoord);

                  // Draw on map
                  if (routePolyline.current) {
                    routePolyline.current.addLatLng([latitude, longitude]);
                  }
                  if (activeWalkMap.current) {
                    activeWalkMap.current.panTo([latitude, longitude]);
                  }
                }
              } else {
                updated.push(newCoord);
              }
              return updated;
            });

            // Emit live location updates
            if (socket) {
              socket.emit('update_location', { lat: latitude, lng: longitude });
              if (buddyMode && buddy) {
                socket.emit('buddy_coordinates', {
                  buddyId: buddy._id,
                  lat: latitude,
                  lng: longitude,
                  speed: speed || 0,
                  timestamp: new Date(),
                });
              }
            }
          },
          (err) => console.error(err),
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
        );
      }
    } catch (err) {
      console.error(err);
      setIsWalking(false);
    }
  };

  // Toggle simulation
  const handleToggleSimulation = () => {
    if (isSimulating) {
      // Turn off simulation
      clearInterval(simulationInterval.current);
      setIsSimulating(false);
    } else {
      // Turn on simulation
      setIsSimulating(true);
      // Start moving automatically
      let simulatedLat = userLocation?.lat || 40.7128;
      let simulatedLng = userLocation?.lng || -74.006;

      simulationInterval.current = setInterval(() => {
        if (isPaused) return;

        // Take a step (approx 5-15 meters in random direction)
        const step = 0.0001 + Math.random() * 0.0001; // degrees
        const angle = Math.random() * Math.PI * 2;
        simulatedLat += Math.sin(angle) * step;
        simulatedLng += Math.cos(angle) * step;

        const newCoord = {
          lat: simulatedLat,
          lng: simulatedLng,
          timestamp: new Date(),
          speed: 1.4, // avg walking speed m/s
        };

        setCoordinates((prev) => {
          const last = prev[prev.length - 1];
          let updated = [...prev];
          if (last) {
            const distIncrement = getDistance(last.lat, last.lng, simulatedLat, simulatedLng);
            setDistance((d) => d + distIncrement);
          }
          updated.push(newCoord);

          // Update active map
          if (routePolyline.current) {
            routePolyline.current.addLatLng([simulatedLat, simulatedLng]);
          }
          if (activeWalkMap.current) {
            activeWalkMap.current.panTo([simulatedLat, simulatedLng]);
          }

          return updated;
        });

        // Emit location via Socket
        if (socket) {
          socket.emit('update_location', { lat: simulatedLat, lng: simulatedLng });
          if (isBuddyWalk && buddyUser) {
            socket.emit('buddy_coordinates', {
              buddyId: buddyUser._id,
              lat: simulatedLat,
              lng: simulatedLng,
              speed: 1.4,
              timestamp: new Date(),
            });
          }
        }
      }, 3000);
    }
  };

  // Pause walk
  const handlePauseToggle = () => {
    if (isPaused) {
      setIsPaused(false);
      // Resume timer
      timerInterval.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
    } else {
      setIsPaused(true);
      clearInterval(timerInterval.current);
    }
  };

  // End walk session
  const handleEndWalk = async () => {
    // Stop timers, watch, simulation
    clearInterval(timerInterval.current);
    if (watchId.current) navigator.geolocation.clearWatch(watchId.current);
    if (simulationInterval.current) clearInterval(simulationInterval.current);

    try {
      // Sync last few coordinates to backend
      const res = await api.post(`/walks/end/${walkSession._id}`, {
        endTime: new Date(),
        distance: Math.round(distance),
        duration,
        coordinates,
      });

      // Save summary & trigger celebration modal
      setCompletionSummary({
        walk: res.data.walkSession,
        earnedXp: res.data.earnedXp,
        isLevelUp: res.data.isLevelUp,
        newBadges: res.data.newBadges,
      });
      setShowCelebration(true);

      // Update local AuthContext user state with updated credentials
      setUser(res.data.user);

      // Refresh walk history
      fetchHistory();
    } catch (err) {
      console.error(err);
    } finally {
      // Clean up variables
      setIsWalking(false);
      setIsPaused(false);
      setWalkSession(null);
      setDuration(0);
      setDistance(0);
      setCoordinates([]);
      setIsSimulating(false);
      buddyMarker.current = null;
      routePolyline.current = null;
      activeWalkMap.current = null;
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Calculate Pace (min/km)
  const formatPace = () => {
    if (distance <= 0) return '0:00';
    const distanceKm = distance / 1000;
    const paceMin = duration / 60 / distanceKm;
    const mins = Math.floor(paceMin);
    const secs = Math.round((paceMin - mins) * 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Format elapsed time (hh:mm:ss)
  const formatTime = (secs) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${h > 0 ? h + ':' : ''}${m < 10 && h > 0 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const stats = [
    {
      label: 'Current Streak',
      value: user?.currentStreak || 0,
      unit: 'days',
      icon: '🔥',
      color: 'var(--accent-primary)',
    },
    {
      label: 'Total Distance',
      value: ((user?.totalDistance || 0) / 1000).toFixed(1),
      unit: 'km',
      iconComponent: MapPin,
      color: '#38bdf8',
    },
    {
      label: 'Total Walks',
      value: user?.totalWalks || 0,
      unit: 'walks',
      iconComponent: Activity,
      color: '#f472b6',
    },
    {
      label: 'Level',
      value: user?.level || 1,
      unit: null,
      iconComponent: Trophy,
      color: '#fbbf24',
      isLevel: true,
    },
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', position: 'relative' }}>
      {/* ===== NAVBAR ===== */}
      <nav
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          background: 'rgba(255, 255, 255, 0.85)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid var(--glass-border)',
          padding: '12px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <Footprints size={28} style={{ color: 'var(--accent-primary)' }} strokeWidth={1.5} />
          <span className="gradient-text" style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5 }}>
            WalkStreak
          </span>
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            Hey, {user?.username || 'Walker'}!
          </span>

          <div style={{ position: 'relative' }} ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: 'var(--accent-gradient)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 14,
                  fontWeight: 700,
                  color: 'white',
                }}
              >
                {(user?.username || 'W')[0].toUpperCase()}
              </div>
              <ChevronDown
                size={16}
                style={{
                  color: 'var(--text-muted)',
                  transition: 'transform 0.2s ease',
                  transform: dropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                }}
              />
            </button>

            {dropdownOpen && (
              <div
                className="glass-card"
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  right: 0,
                  padding: 8,
                  minWidth: 180,
                  border: '1px solid var(--glass-border)',
                }}
              >
                <Link
                  to="/profile"
                  onClick={() => setDropdownOpen(false)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 14px',
                    borderRadius: 8,
                    color: 'var(--text-primary)',
                    textDecoration: 'none',
                    fontSize: 14,
                    transition: 'background 0.2s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-card-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <User size={16} />
                  Profile
                </Link>
                <hr style={{ border: 'none', borderTop: '1px solid var(--glass-border)', margin: '4px 0' }} />
                <button
                  onClick={handleLogout}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 14px',
                    borderRadius: 8,
                    color: 'var(--danger)',
                    fontSize: 14,
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    width: '100%',
                    transition: 'background 0.2s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-card-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <LogOut size={16} />
                  Log out
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* ===== ACTIVE WALK SCREEN OVERLAY ===== */}
      {isWalking && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            background: 'var(--bg-primary)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Active Walk Map */}
          <div style={{ flex: 1, position: 'relative' }}>
            <div ref={activeMapContainerRef} style={{ width: '100%', height: '100%' }} />

            {/* Simulating Overlay Watermark */}
            {isSimulating && (
              <div
                style={{
                  position: 'absolute',
                  top: 20,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: 'rgba(15, 81, 50, 0.9)',
                  padding: '6px 14px',
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 600,
                  zIndex: 1000,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  boxShadow: '0 0 15px rgba(15, 81, 50, 0.25)',
                  color: 'white',
                }}
              >
                <Sparkles size={14} />
                Simulated Walking Active
              </div>
            )}

            {/* Top Back/Invite banner */}
            {isBuddyWalk && buddyUser && (
              <div
                style={{
                  position: 'absolute',
                  top: 20,
                  left: 20,
                  background: 'var(--glass-bg)',
                  border: '1px solid var(--glass-border)',
                  padding: '10px 16px',
                  borderRadius: 12,
                  zIndex: 1000,
                  fontSize: 13,
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <Users size={16} style={{ color: 'var(--accent-secondary)' }} />
                <span>Walking with <strong style={{ color: 'var(--text-primary)' }}>{buddyUser.username}</strong></span>
              </div>
            )}
          </div>

          {/* Stats & Controller Dashboard Panel */}
          <div
            className="glass-card"
            style={{
              padding: '24px 32px',
              borderRadius: '24px 24px 0 0',
              borderBottom: 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
              zIndex: 1000,
            }}
          >
            {/* Live Metrics Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 16,
                textAlign: 'center',
              }}
            >
              <div>
                <span style={{ color: 'var(--text-secondary)', fontSize: 13, display: 'block', marginBottom: 4 }}>
                  Time
                </span>
                <span style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                  {formatTime(duration)}
                </span>
              </div>
              <div>
                <span style={{ color: 'var(--text-secondary)', fontSize: 13, display: 'block', marginBottom: 4 }}>
                  Distance
                </span>
                <span style={{ fontSize: 28, fontWeight: 800, color: 'var(--accent-primary)', fontFamily: 'monospace' }}>
                  {(distance / 1000).toFixed(2)} <span style={{ fontSize: 14 }}>km</span>
                </span>
              </div>
              <div>
                <span style={{ color: 'var(--text-secondary)', fontSize: 13, display: 'block', marginBottom: 4 }}>
                  Avg Pace
                </span>
                <span style={{ fontSize: 28, fontWeight: 800, color: '#38bdf8', fontFamily: 'monospace' }}>
                  {formatPace()} <span style={{ fontSize: 14 }}>/km</span>
                </span>
              </div>
              <div>
                <span style={{ color: 'var(--text-secondary)', fontSize: 13, display: 'block', marginBottom: 4 }}>
                  Speed
                </span>
                <span style={{ fontSize: 28, fontWeight: 800, color: '#f472b6', fontFamily: 'monospace' }}>
                  {coordinates.length > 0 && coordinates[coordinates.length - 1].speed
                    ? (coordinates[coordinates.length - 1].speed * 3.6).toFixed(1)
                    : (distance > 0 ? ((distance / duration) * 3.6).toFixed(1) : '0.0')}
                  <span style={{ fontSize: 14 }}> km/h</span>
                </span>
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 14, justifyContent: 'center', alignItems: 'center' }}>
              <button
                className="btn-secondary"
                onClick={handleToggleSimulation}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  borderColor: isSimulating ? 'var(--accent-primary)' : 'var(--glass-border)',
                  background: isSimulating ? 'rgba(15, 81, 50, 0.1)' : 'var(--glass-bg)',
                }}
              >
                <Sparkles size={16} style={{ color: 'var(--accent-primary)' }} />
                {isSimulating ? 'Stop Simulation' : 'Simulate Walking'}
              </button>

              <button
                onClick={handlePauseToggle}
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--glass-border)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-primary)',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--text-primary)')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--glass-border)')}
              >
                {isPaused ? <Play size={20} fill="currentColor" /> : <Pause size={20} fill="currentColor" />}
              </button>

              <button
                onClick={handleEndWalk}
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  background: 'var(--danger)',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  transition: 'transform 0.2s',
                  boxShadow: '0 0 20px rgba(239, 68, 68, 0.4)',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.08)')}
                onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
              >
                <Square size={20} fill="white" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== CELEBRATION MODAL ===== */}
      {showCelebration && completionSummary && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 110,
            background: 'rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(15px)',
            WebkitBackdropFilter: 'blur(15px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <div
            className="glass-card fade-in"
            style={{
              width: '100%',
              maxWidth: 500,
              padding: 40,
              textAlign: 'center',
              boxShadow: '0 0 50px rgba(15, 81, 50, 0.15)',
              position: 'relative',
              background: 'white',
            }}
          >
            <button
              onClick={() => setShowCelebration(false)}
              style={{
                position: 'absolute',
                top: 20,
                right: 20,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-secondary)',
              }}
            >
              <X size={20} />
            </button>

            <span style={{ fontSize: 64, display: 'block', marginBottom: 16 }}>🎉</span>
            <h2 className="gradient-text" style={{ fontSize: 32, fontWeight: 900, marginBottom: 8 }}>
              Walk Completed!
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 28 }}>
              Phenomenal effort! You're building a stronger lifestyle.
            </p>

            {/* Summary Details */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 12,
                background: 'rgba(0, 0, 0, 0.03)',
                padding: 16,
                borderRadius: 12,
                border: '1px solid var(--glass-border)',
                marginBottom: 24,
              }}
            >
              <div>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 2 }}>
                  Distance
                </span>
                <strong style={{ fontSize: 16, color: 'var(--text-primary)' }}>
                  {(completionSummary.walk.distance / 1000).toFixed(2)} km
                </strong>
              </div>
              <div>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 2 }}>
                  Duration
                </span>
                <strong style={{ fontSize: 16, color: 'var(--text-primary)' }}>
                  {formatTime(completionSummary.walk.duration)}
                </strong>
              </div>
              <div>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 2 }}>
                  Avg Pace
                </span>
                <strong style={{ fontSize: 16, color: 'var(--text-primary)' }}>
                  {completionSummary.walk.averagePace > 0
                    ? `${Math.floor(completionSummary.walk.averagePace)}:${Math.round(
                        (completionSummary.walk.averagePace -
                          Math.floor(completionSummary.walk.averagePace)) *
                          60
                      )
                        .toString()
                        .padStart(2, '0')}`
                    : '0:00'}{' '}
                  /km
                </strong>
              </div>
            </div>

            {/* XP and Rewards */}
            <div style={{ marginBottom: 28 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                <span style={{ color: 'var(--text-secondary)' }}>XP Awarded</span>
                <strong style={{ color: 'var(--accent-primary)' }}>+{completionSummary.earnedXp} XP</strong>
              </div>
              {completionSummary.isLevelUp && (
                <div
                  style={{
                    background: 'rgba(251, 191, 36, 0.15)',
                    border: '1px solid rgba(251, 191, 36, 0.3)',
                    color: '#fbbf24',
                    padding: '8px 12px',
                    borderRadius: 8,
                    fontWeight: 700,
                    fontSize: 14,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    marginBottom: 12,
                    animation: 'pulse-glow 1.5s infinite',
                  }}
                >
                  <Trophy size={16} />
                  LEVEL UP! Reached Level {user.level}!
                </div>
              )}
            </div>

            {/* Badges Earned */}
            {completionSummary.newBadges?.length > 0 && (
              <div style={{ marginBottom: 28 }}>
                <h3
                  style={{
                    fontSize: 14,
                    color: 'var(--text-primary)',
                    fontWeight: 600,
                    marginBottom: 12,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  <Award size={16} style={{ color: 'var(--accent-primary)' }} />
                  Achievements Unlocked!
                </h3>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
                  {completionSummary.newBadges.map((badge) => (
                    <div
                      key={badge.name}
                      style={{
                        padding: '10px 14px',
                        background: 'var(--bg-card)',
                        border: '1px solid var(--glass-border)',
                        borderRadius: 12,
                        minWidth: 100,
                      }}
                    >
                      <span style={{ fontSize: 24, display: 'block', marginBottom: 4 }}>{badge.icon}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-primary)', fontWeight: 600 }}>{badge.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button className="btn-primary" onClick={() => setShowCelebration(false)} style={{ width: '100%' }}>
              Continue
            </button>
          </div>
        </div>
      )}

      {/* ===== MAIN CONTENT ===== */}
      <main
        style={{
          paddingTop: 80,
          paddingLeft: 24,
          paddingRight: 24,
          paddingBottom: 40,
          maxWidth: 1200,
          margin: '0 auto',
        }}
      >
        {/* Stats Cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 16,
            marginBottom: 32,
          }}
        >
          {stats.map((stat, index) => (
            <div
              key={stat.label}
              className="glass-card fade-in"
              style={{
                padding: 24,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                animationDelay: `${index * 0.08}s`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: 14, fontWeight: 500 }}>
                  {stat.label}
                </span>
                {stat.icon ? (
                  <span style={{ fontSize: 24 }}>{stat.icon}</span>
                ) : (
                  <stat.iconComponent size={22} style={{ color: stat.color }} />
                )}
              </div>
              <span style={{ fontSize: 36, fontWeight: 800, color: stat.color }}>{stat.value}</span>
              {stat.unit && (
                <span style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: -4 }}>{stat.unit}</span>
              )}
              {stat.isLevel && (
                <div>
                  <div
                    style={{
                      height: 6,
                      background: 'var(--glass-border)',
                      borderRadius: 3,
                      overflow: 'hidden',
                      marginTop: 4,
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        background: 'linear-gradient(90deg, #fbbf24, #f59e0b)',
                        borderRadius: 3,
                        width: `${Math.min(((user?.xp || 0) % 1000) / 10, 100)}%`,
                        transition: 'width 0.5s ease',
                      }}
                    />
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                    {user?.xp || 0} XP
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Dashboard Split Screen */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) 360px',
            gap: 24,
            alignItems: 'start',
          }}
        >
          {/* LEFT COLUMN: Map & Quick Start + History */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* START WALK BOARD */}
            <div
              className="glass-card"
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 300px',
                minHeight: 300,
                overflow: 'hidden',
              }}
            >
              {/* Map Preview */}
              <div style={{ position: 'relative', minHeight: 300 }}>
                <div ref={mapContainerRef} style={{ width: '100%', height: '100%', minHeight: 300 }} />
                <button
                  onClick={getCurrentLocation}
                  style={{
                    position: 'absolute',
                    bottom: 16,
                    left: 16,
                    zIndex: 400,
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: 'var(--glass-bg)',
                    border: '1px solid var(--glass-border)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                  }}
                >
                  <Compass size={18} />
                </button>
              </div>

              {/* Start panel */}
              <div
                style={{
                  padding: 32,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  textAlign: 'center',
                  background: 'rgba(255, 255, 255, 0.4)',
                  borderLeft: '1px solid var(--glass-border)',
                }}
              >
                <div
                  style={{
                    position: 'relative',
                    width: 140,
                    height: 140,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      width: '100%',
                      height: '100%',
                      borderRadius: '50%',
                      border: '2px solid transparent',
                      borderTopColor: 'rgba(15, 81, 50, 0.3)',
                      borderRightColor: 'rgba(25, 135, 84, 0.3)',
                      animation: 'spin-slow 6s linear infinite',
                    }}
                  />
                  <button
                    onClick={() => initiateWalk(false, null)}
                    className="btn-primary"
                    style={{
                      width: 110,
                      height: 110,
                      borderRadius: '50%',
                      padding: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                      fontSize: 16,
                    }}
                  >
                    <span>START</span>
                    <Footprints size={20} />
                  </button>
                </div>
                <p style={{ marginTop: 16, color: 'var(--text-secondary)', fontSize: 13 }}>
                  Tap to start a walk and map your progress!
                </p>
              </div>
            </div>

            {/* WALK HISTORY LIST */}
            <div>
              <h2
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  marginBottom: 16,
                  color: 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <Activity size={20} style={{ color: 'var(--accent-primary)' }} />
                Recent Walks
              </h2>

              {historyLoading ? (
                <div className="glass-card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                  Loading history...
                </div>
              ) : walkHistory.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {walkHistory.slice(0, 5).map((walk) => (
                    <div
                      key={walk._id}
                      className="glass-card"
                      style={{
                        padding: '16px 20px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: 10,
                            background: walk.isBuddyWalk ? 'rgba(25, 135, 84, 0.1)' : 'rgba(15, 81, 50, 0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: walk.isBuddyWalk ? 'var(--accent-secondary)' : 'var(--accent-primary)',
                          }}
                        >
                          <Footprints size={22} />
                        </div>
                        <div>
                          <strong style={{ color: 'var(--text-primary)', fontSize: 15, display: 'block', marginBottom: 2 }}>
                            {(walk.distance / 1000).toFixed(2)} km Walk
                          </strong>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            {new Date(walk.startTime).toLocaleDateString()} at{' '}
                            {new Date(walk.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            {walk.isBuddyWalk && walk.buddyUserId && ` • with ${walk.buddyUserId.username}`}
                          </span>
                        </div>
                      </div>

                      <div style={{ textAlign: 'right', display: 'flex', gap: 20 }}>
                        <div>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block' }}>Duration</span>
                          <strong style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                            {formatTime(walk.duration)}
                          </strong>
                        </div>
                        <div>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block' }}>Avg Pace</span>
                          <strong style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                            {walk.averagePace > 0
                              ? `${Math.floor(walk.averagePace)}:${Math.round(
                                  (walk.averagePace - Math.floor(walk.averagePace)) * 60
                                )
                                  .toString()
                                  .padStart(2, '0')} /km`
                              : '0:00'}
                          </strong>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="glass-card" style={{ padding: 40, textAlign: 'center' }}>
                  <Footprints
                    size={48}
                    style={{ color: 'var(--text-muted)', margin: '0 auto 16px', opacity: 0.5, display: 'block' }}
                  />
                  <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                    No walks yet
                  </p>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    Hit START to begin your walk session!
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: Social Feed & Buddy Invites */}
          <div
            className="glass-card"
            style={{
              padding: 20,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              maxHeight: 650,
              overflow: 'hidden',
            }}
          >
            {/* Tab selector */}
            <div
              style={{
                display: 'flex',
                background: 'rgba(255, 255, 255, 0.03)',
                padding: 4,
                borderRadius: 10,
                border: '1px solid var(--glass-border)',
              }}
            >
              <button
                onClick={() => setActiveTab('nearby')}
                style={{
                  flex: 1,
                  padding: '8px 0',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  color: activeTab === 'nearby' ? 'white' : 'var(--text-secondary)',
                  background: activeTab === 'nearby' ? 'var(--bg-card)' : 'transparent',
                  transition: 'all 0.2s',
                }}
              >
                Nearby ({nearbyWalkers.length})
              </button>
              <button
                onClick={() => setActiveTab('following')}
                style={{
                  flex: 1,
                  padding: '8px 0',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  color: activeTab === 'following' ? 'white' : 'var(--text-secondary)',
                  background: activeTab === 'following' ? 'var(--bg-card)' : 'transparent',
                  transition: 'all 0.2s',
                }}
              >
                Following
              </button>
              <button
                onClick={() => setActiveTab('invites')}
                style={{
                  flex: 1,
                  padding: '8px 0',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  position: 'relative',
                  color: activeTab === 'invites' ? 'white' : 'var(--text-secondary)',
                  background: activeTab === 'invites' ? 'var(--bg-card)' : 'transparent',
                  transition: 'all 0.2s',
                }}
              >
                Invites
                {pendingRequests.incoming.length > 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      top: 4,
                      right: 4,
                      width: 6,
                      height: 6,
                      background: 'var(--accent-primary)',
                      borderRadius: '50%',
                    }}
                  />
                )}
              </button>
            </div>

            {/* List Panel */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* TAB 1: NEARBY WALKERS */}
              {activeTab === 'nearby' &&
                (nearbyWalkers.length > 0 ? (
                  nearbyWalkers.map((walker) => (
                    <div
                      key={walker._id}
                      style={{
                        padding: 12,
                        background: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid var(--glass-border)',
                        borderRadius: 12,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            background: 'var(--accent-gradient)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 12,
                            fontWeight: 700,
                            color: 'white',
                          }}
                        >
                          {walker.username[0].toUpperCase()}
                        </div>
                        <div>
                          <strong style={{ fontSize: 13, color: 'white', display: 'block' }}>
                            {walker.username}
                          </strong>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            Level {walker.level} • {walker.currentStreak}d streak
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          onClick={() => handleFollowToggle(walker)}
                          style={{
                            padding: '6px 10px',
                            borderRadius: 8,
                            fontSize: 11,
                            border: '1px solid var(--glass-border)',
                            background: 'var(--glass-bg)',
                            color: walker.isFollowing ? 'var(--text-muted)' : 'var(--accent-primary)',
                            cursor: 'pointer',
                          }}
                        >
                          {walker.isFollowing ? 'Unfollow' : 'Follow'}
                        </button>
                        <button
                          onClick={() => handleInviteToWalk(walker._id)}
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 8,
                            background: 'var(--accent-gradient)',
                            border: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            cursor: 'pointer',
                          }}
                          title="Invite to Buddy Walk"
                        >
                          <Send size={12} />
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, padding: '20px 0' }}>
                    No nearby walkers online.
                  </div>
                ))}

              {/* TAB 2: FOLLOWING LIST */}
              {activeTab === 'following' &&
                (followingList.length > 0 ? (
                  followingList.map((walker) => (
                    <div
                      key={walker._id}
                      style={{
                        padding: 12,
                        background: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid var(--glass-border)',
                        borderRadius: 12,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            background: 'var(--accent-gradient)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 12,
                            fontWeight: 700,
                            color: 'white',
                            opacity: walker.isOnline ? 1 : 0.6,
                          }}
                        >
                          {walker.username[0].toUpperCase()}
                        </div>
                        <div>
                          <strong style={{ fontSize: 13, color: 'white', display: 'block' }}>
                            {walker.username}
                          </strong>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {walker.isOnline ? (
                              <span style={{ color: 'var(--accent-primary)' }}>Online • Walking</span>
                            ) : (
                              'Offline'
                            )}
                          </span>
                        </div>
                      </div>

                      {walker.isOnline && (
                        <button
                          onClick={() => handleInviteToWalk(walker._id)}
                          style={{
                            padding: '6px 10px',
                            borderRadius: 8,
                            fontSize: 11,
                            background: 'var(--accent-gradient)',
                            border: 'none',
                            color: 'white',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <Send size={10} /> Invite
                        </button>
                      )}
                    </div>
                  ))
                ) : (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, padding: '20px 0' }}>
                    You are not following anyone yet.
                  </div>
                ))}

              {/* TAB 3: INCOMING & OUTGOING INVITES */}
              {activeTab === 'invites' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* Incoming Section */}
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 8 }}>
                      INCOMING INVITES
                    </span>
                    {pendingRequests.incoming.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {pendingRequests.incoming.map((req) => (
                          <div
                            key={req._id}
                            style={{
                              padding: 10,
                              background: 'rgba(0, 212, 170, 0.05)',
                              border: '1px solid rgba(0, 212, 170, 0.2)',
                              borderRadius: 10,
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div
                                style={{
                                  width: 28,
                                  height: 28,
                                  borderRadius: '50%',
                                  background: 'var(--accent-gradient)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: 11,
                                  color: 'white',
                                }}
                              >
                                {req.senderId.username[0].toUpperCase()}
                              </div>
                              <span style={{ fontSize: 12, color: 'white', fontWeight: 500 }}>
                                {req.senderId.username}
                              </span>
                            </div>
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button
                                onClick={() => handleRespondRequest(req._id, req.senderId._id, 'accepted')}
                                style={{
                                  width: 24,
                                  height: 24,
                                  borderRadius: 6,
                                  background: 'var(--success)',
                                  border: 'none',
                                  color: 'white',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                <Check size={12} />
                              </button>
                              <button
                                onClick={() => handleRespondRequest(req._id, req.senderId._id, 'declined')}
                                style={{
                                  width: 24,
                                  height: 24,
                                  borderRadius: 6,
                                  background: 'var(--danger)',
                                  border: 'none',
                                  color: 'white',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                <X size={12} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', padding: '10px 0' }}>
                        No incoming invites.
                      </div>
                    )}
                  </div>

                  {/* Outgoing Section */}
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 8 }}>
                      OUTGOING INVITES
                    </span>
                    {pendingRequests.outgoing.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {pendingRequests.outgoing.map((req) => (
                          <div
                            key={req._id}
                            style={{
                              padding: 10,
                              background: 'rgba(255, 255, 255, 0.02)',
                              border: '1px solid var(--glass-border)',
                              borderRadius: 10,
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}
                          >
                            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                              Sent to <strong>{req.receiverId.username}</strong>
                            </span>
                            <span style={{ fontSize: 11, color: 'var(--warning)', fontWeight: 500 }}>
                              Pending
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', padding: '10px 0' }}>
                        No outgoing invites.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
