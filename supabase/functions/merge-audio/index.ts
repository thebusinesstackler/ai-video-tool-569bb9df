import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface AudioSegment {
  audioUrl: string;
  duration: number;
  sceneNumber: number;
}

interface MergeRequest {
  segments: AudioSegment[];
  userId: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { segments, userId } = await req.json() as MergeRequest;

    // Return gracefully if no segments provided (e.g., lip sync videos have embedded audio)
    if (!segments || segments.length === 0) {
      console.log('No audio segments to merge - this is OK if videos have embedded audio');
      return new Response(
        JSON.stringify({
          success: true,
          audioUrl: null,
          totalDuration: 0,
          segmentCount: 0,
          skipped: true,
          reason: 'No audio segments provided'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Merging ${segments.length} audio segments for user ${userId}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Download all audio files and concatenate them (skip silent/empty segments)
    const audioBuffers: Uint8Array[] = [];
    
    for (const segment of segments.sort((a, b) => a.sceneNumber - b.sceneNumber)) {
      // Skip empty audio segments (silent CTA scenes)
      if (!segment.audioUrl || segment.audioUrl === '') {
        console.log(`Skipping silent segment for scene ${segment.sceneNumber}`);
        continue;
      }
      
      let audioData: Uint8Array;
      
      if (segment.audioUrl.startsWith('data:')) {
        // Base64 audio - decode it
        const base64Match = segment.audioUrl.match(/^data:[^;]+;base64,(.+)$/);
        if (base64Match) {
          const binaryString = atob(base64Match[1]);
          audioData = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            audioData[i] = binaryString.charCodeAt(i);
          }
        } else {
          console.error('Invalid base64 audio for scene', segment.sceneNumber);
          continue;
        }
      } else {
        // URL - fetch it
        try {
          const response = await fetch(segment.audioUrl);
          if (!response.ok) {
            console.error('Failed to fetch audio:', segment.audioUrl);
            continue;
          }
          const buffer = await response.arrayBuffer();
          audioData = new Uint8Array(buffer);
        } catch (fetchError) {
          console.error('Error fetching audio:', fetchError);
          continue;
        }
      }
      
      audioBuffers.push(audioData);
      console.log(`Added audio segment ${segment.sceneNumber}, size: ${audioData.length}`);
    }

    if (audioBuffers.length === 0) {
      throw new Error('No audio segments could be processed');
    }

    // Simple concatenation - works for MP3 files
    // Note: For perfect seamless audio, a proper audio processing library would be needed
    const totalLength = audioBuffers.reduce((acc, buf) => acc + buf.length, 0);
    const mergedAudio = new Uint8Array(totalLength);
    let offset = 0;
    
    for (const buffer of audioBuffers) {
      mergedAudio.set(buffer, offset);
      offset += buffer.length;
    }

    console.log(`Merged audio total size: ${mergedAudio.length}`);

    // Upload merged audio to storage
    const fileName = `${userId}/${Date.now()}-merged-voiceover.mp3`;
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('reels')
      .upload(fileName, mergedAudio, { 
        contentType: 'audio/mp3',
        cacheControl: '3600'
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      throw new Error(`Failed to upload merged audio: ${uploadError.message}`);
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('reels')
      .getPublicUrl(fileName);

    const publicUrl = publicUrlData.publicUrl;
    const totalDuration = segments.reduce((acc, s) => acc + s.duration, 0);

    console.log(`Merged audio uploaded: ${publicUrl}, total duration: ${totalDuration}s`);

    return new Response(
      JSON.stringify({
        success: true,
        audioUrl: publicUrl,
        totalDuration,
        segmentCount: segments.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in merge-audio:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
