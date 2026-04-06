import { useParams } from 'react-router-dom';

// Placeholder — we build the real map here next phase.
// useParams reads the :realmId segment from the URL /map/:realmId

const MapPage = () => {
  const { realmId } = useParams();

  return (
    <div className="min-h-screen bg-[#0f1117] flex items-center justify-center">
      <div className="text-center">
        <p className="text-purple-300/60 text-sm">Map coming soon</p>
        <p className="text-purple-400/30 text-xs mt-1 font-mono">{realmId}</p>
      </div>
    </div>
  );
};

export default MapPage;