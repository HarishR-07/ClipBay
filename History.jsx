import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { ArrowLeft, Trash2, Film } from 'lucide-react'

export default function History({ session, onBack }) {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState(null)

  useEffect(() => {
    loadProjects()
  }, [])

  const loadProjects = async () => {
    setLoading(true)
    setError('')
    try {
      const { data, error: fetchErr } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
      if (fetchErr) throw fetchErr

      const withUrls = await Promise.all(
        (data || []).map(async (p) => {
          const { data: signed } = await supabase.storage
            .from('videos')
            .createSignedUrl(p.video_path, 3600)
          return { ...p, videoUrl: signed?.signedUrl || null }
        })
      )
      setProjects(withUrls)
    } catch (err) {
      setError('Could not load history: ' + err.message)
    }
    setLoading(false)
  }

  const deleteProject = async (project) => {
    setDeletingId(project.id)
    try {
      await supabase.storage.from('videos').remove([project.video_path])
      await supabase.from('projects').delete().eq('id', project.id)
      setProjects((prev) => prev.filter((p) => p.id !== project.id))
    } catch (err) {
      setError('Could not delete: ' + err.message)
    }
    setDeletingId(null)
  }

  const cardStyle = {
    background: '#1E1B2A',
    border: '2px solid #2E2A3F',
    borderRadius: '12px',
    padding: '14px',
    marginBottom: '14px',
  }

  return (
    <div style={{ minHeight: '100vh', background: '#14121C', color: '#F5F3FA', fontFamily: 'sans-serif', padding: '24px 20px' }}>
      <div style={{ maxWidth: '480px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
          <button
            onClick={onBack}
            style={{ background: 'none', border: 'none', color: '#F5F3FA', display: 'flex', alignItems: 'center', cursor: 'pointer' }}
          >
            <ArrowLeft size={20} />
          </button>
          <h1 style={{ fontSize: '20px', fontWeight: 700 }}>History</h1>
        </div>

        {loading && <p style={{ color: '#9691A8', fontSize: '14px' }}>Loading...</p>}
        {error && <p style={{ color: '#FF5D8F', fontSize: '13px', marginBottom: '12px' }}>{error}</p>}

        {!loading && projects.length === 0 && !error && (
          <div style={{ textAlign: 'center', color: '#6B6780', marginTop: '60px' }}>
            <Film size={32} style={{ margin: '0 auto 12px' }} />
            <p style={{ fontSize: '14px' }}>No saved projects yet.</p>
          </div>
        )}

        {projects.map((project) => (
          <div key={project.id} style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
              <div>
                {project.mood && (
                  <span style={{ fontSize: '11px', color: '#FF9F45', fontWeight: 600, textTransform: 'uppercase' }}>
                    {project.mood}
                  </span>
                )}
                <div style={{ fontSize: '12px', color: '#6B6780', marginTop: '2px' }}>
                  {new Date(project.created_at).toLocaleString()}
                </div>
              </div>
              <button
                onClick={() => deleteProject(project)}
                disabled={deletingId === project.id}
                style={{ background: 'none', border: 'none', color: '#FF5D8F', cursor: 'pointer', padding: '4px' }}
              >
                <Trash2 size={16} />
              </button>
            </div>

            {project.videoUrl ? (
              <video controls src={project.videoUrl} style={{ width: '100%', borderRadius: '8px' }} />
            ) : (
              <p style={{ fontSize: '12px', color: '#6B6780' }}>Video unavailable</p>
            )}

            {project.script && (
              <p style={{ fontSize: '13px', color: '#9691A8', marginTop: '10px', lineHeight: '1.5' }}>{project.script}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
