import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User } from 'lucide-react';

interface AITwin {
  id: string;
  name: string;
  voice_cloning_key: string | null;
}

interface TwinSelectorProps {
  value?: string;
  onSelect: (twinId: string, twinName: string) => void;
  label?: string;
}

export function TwinSelector({ value, onSelect, label = "Select AI Twin" }: TwinSelectorProps) {
  const [twins, setTwins] = useState<AITwin[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTwins() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('ai_twins')
        .select('id, name, voice_cloning_key')
        .eq('user_id', user.id)
        .order('name');

      if (!error && data) {
        setTwins(data);
      }
      setLoading(false);
    }

    fetchTwins();
  }, []);

  const selectedTwin = twins.find(t => t.id === value);

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={(id) => {
        const twin = twins.find(t => t.id === id);
        if (twin) onSelect(id, twin.name);
      }}>
        <SelectTrigger>
          <SelectValue placeholder={loading ? "Loading..." : "Choose an AI Twin"}>
            {selectedTwin && (
              <div className="flex items-center gap-2">
                <Avatar className="h-6 w-6">
                  <AvatarFallback><User className="h-3 w-3" /></AvatarFallback>
                </Avatar>
                <span>{selectedTwin.name}</span>
              </div>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {twins.length === 0 ? (
            <div className="p-2 text-sm text-muted-foreground">
              No AI Twins created yet
            </div>
          ) : (
            twins.map((twin) => (
              <SelectItem key={twin.id} value={twin.id}>
                <div className="flex items-center gap-2">
                  <Avatar className="h-6 w-6">
                    <AvatarFallback><User className="h-3 w-3" /></AvatarFallback>
                  </Avatar>
                  <span>{twin.name}</span>
                  {!twin.voice_cloning_key && (
                    <span className="text-xs text-muted-foreground">(no voice)</span>
                  )}
                </div>
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
    </div>
  );
}
