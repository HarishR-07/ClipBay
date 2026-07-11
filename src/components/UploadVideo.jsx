import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { Upload, Film, LogOut, CheckCircle2 } from 'lucide-react'
import { extractFrames } from '../extractFrames'

export default function UploadVideo({ session }) {
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState('')
  const [uploadedPath, setUploadedPath] = useState(null)
  const [error, setError] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [mood, setMood] = useState(null)
  const [script, setScript] = useState('')
  const [editingScript, setEditingScript] = useState(false)
  const [generatingVoice, setGeneratingVoice] = useState(false)
  const [audioUrl, setAudioUrl] = useState(null)

  const handleFileSelect = (e) => {
    const selected = e.target.files[0]
    if (selected) {
      setFile(selected)
      setUploadedPath(null)
      setError('')
      setMood(null)
      setScript('')
      setAudioUrl(null)
    }
  }

  const analyzeVideo = async (selectedFile) => {
    setAnalyzing(true)
    setError('')
    try {
      const frames = await extractFrames(selectedFile)
      const res = await fetch('/api/analyze-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ frames }),
      })
      const result = await res.json()
      if (result.error) throw new Error(result.error)
      setMood(result.mood)
      setScript(result.script)
    } catch (err) {
      setError('Analysis failed: ' + err.message)
    }
    setAnalyzing(false)
  }

  const generateVoice = async (provider) => {
    setGeneratingVoice(true)
    setError('')
    setAudioUrl(null)
    try {
      const res = await fetch('/api/generate-voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script, provider }),
      })
      const result = await res.json()
      if (result.error) throw new Error(result.error)
      const audioSrc = `data:${result.mimeType};base64,${result.audio}`
      setAudioUrl(audioSrc)
    } catch (err) {
      setError('Voice generation failed: ' + err.message)
    }
    setGeneratingVoice(false)
  }

  const handleUpload = async () => {
    if (!file) return
    setUploading(true)
    setError('')
    setProgress('Uploading...')

    const filePath = `${session.user.id}/${Date.now()}_${file.name}`

    const { data, error: uploadError } = await supabase.storage
      .from('videos')
      .upload(filePath, file)

    if (uploadError) {
      setError(uploadError.message)
      setUploading(false)
      return
    }

    setUploadedPath(filePath)
    setProgress('Uploaded successfully')
    setUploading(false)

    analyzeVideo(file)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#14121C', color: '#F5F3FA', fontFamily: 'sans-serif', padding: '24px 20px' }}>
      <div style={{ maxWidth: '480px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'linear-gradient(135deg, #FF5D8F, #FF9F45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Film size={17} color="#14121C" />
            </div>
            <span style={{ fontWeight: 700, fontSize: '15px', letterSpacing: '0.05em' }}>CLIP BAY</span>
          </div>
          <button
            onClick={() => supabase.auth.signOut()}
            style={{ background: 'none', border: 'none', color: '#6B6780', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}
          >
            <LogOut size={14} /> Log out
          </button>
        </div>

        <h1 style={{ fontSize: '26px', fontWeight: 700, marginBottom: '6px' }}>Upload your clip</h1>
        <p style={{ color: '#9691A8', fontSize: '14px', marginBottom: '24px' }}>
          We'll analyze the footage and suggest a script that matches its mood.
        </p>

        <label
          htmlFor="video-upload"
          style={{
            display: 'block',
            border: '2px dashed #2E2A3F',
            borderRadius: '14px',
            padding: '36px 20px',
            textAlign: 'center',
            cursor: 'pointer',
            background: '#1E1B2A',
          }}
        >
          <Upload size={26} color="#6B6780" style={{ margin: '0 auto 10px' }} />
          <div style={{ fontSize: '14px', color: file ? '#F5F3FA' : '#9691A8' }}>
            {file ? file.name : 'Tap to choose a video'}
          </div>
          <input
            id="video-upload"
            type="file"
            accept="video/*"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
        </label>

        {file && !uploadedPath && (
          <button
            onClick={handleUpload}
            disabled={uploading}
            style={{
              width: '100%',
              marginTop: '16px',
              padding: '13px',
              background: 'linear-gradient(135deg, #FF5D8F, #FF9F45)',
              border: 'none',
              borderRadius: '10px',
              color: '#14121C',
              fontWeight: 600,
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            {uploading ? progress : 'Upload video'}
          </button>
        )}

        {uploadedPath && (
          <div style={{ marginTop: '16px', padding: '16px', background: '#1E1B2A', border: '2px solid #2E2A3F', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <CheckCircle2 size={18} color="#C6F135" />
            <span style={{ fontSize: '13px' }}>Uploaded successfully.</span>
          </div>
        )}

        {analyzing && (
          <div style={{ marginTop: '16px', textAlign: 'center', color: '#9691A8', fontSize: '13px' }}>
            Analyzing your footage...
          </div>
        )}

        {mood && !analyzing && (
          <div style={{ marginTop: '16px', padding: '16px', background: '#1E1B2A', border: '2px solid #2E2A3F', borderRadius: '10px' }}>
            <div style={{ fontSize: '12px', color: '#FF9F45', fontWeight: 600, marginBottom: '8px', textTransform: 'uppercase' }}>
              Mood: {mood}
            </div>
            {editingScript ? (
              <textarea
                value={script}
                onChange={(e) => setScript(e.target.value)}
                style={{ width: '100%', minHeight: '100px', background: '#14121C', color: '#F5F3FA', border: '1px solid #2E2A3F', borderRadius: '8px', padding: '10px', fontSize: '13px' }}
              />
            ) : (
              <p style={{ fontSize: '14px', lineHeight: '1.5' }}>{script}</p>
            )}
            <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
              <button
                onClick={() => analyzeVideo(file)}
                style={{ flex: 1, padding: '10px', background: '#2E2A3F', border: 'none', borderRadius: '8px', color: '#F5F3FA', fontSize: '13px', cursor: 'pointer' }}
              >
                Regenerate
              </button>
              <button
                onClick={() => setEditingScript(!editingScript)}
                style={{ flex: 1, padding: '10px', background: '#2E2A3F', border: 'none', borderRadius: '8px', color: '#F5F3FA', fontSize: '13px', cursor: 'pointer' }}
              >
                {editingScript ? 'Done editing' : 'Write my own'}
              </button>
            </div>

            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #2E2A3F' }}>
              <div style={{ fontSize: '12px', color: '#9691A8', marginBottom: '10px' }}>Generate voiceover:</div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => generateVoice('openai')}
                  disabled={generatingVoice}
                  style={{ flex: 1, padding: '10px', background: '#2E2A3F', border: 'none', borderRadius: '8px', color: '#F5F3FA', fontSize: '13px', cursor: 'pointer' }}
                >
                  {generatingVoice ? 'Generating...' : 'Free voice'}
                </button>
                <button
                  onClick={() => generateVoice('elevenlabs')}
                  disabled={generatingVoice}
                  style={{ flex: 1, padding: '10px', background: 'linear-gradient(135deg, #FF5D8F, #FF9F45)', border: 'none', borderRadius: '8px', color: '#14121C', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
                >
                  {generatingVoice ? 'Generating...' : 'Premium voice'}
                </button>
              </div>

              {audioUrl && (
                <audio controls src={audioUrl} style={{ width: '100%', marginTop: '12px' }} />
              )}
            </div>
          </div>
        )}

        {error && <p style={{ color: '#FF5D8F', fontSize: '13px', marginTop: '12px' }}>{error}</p>}
      </div>
    </div>
  )
}
