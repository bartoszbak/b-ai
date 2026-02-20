import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import type { ChatSettings } from "@/features/chat/types"

interface ChatStats {
  sentCount: number
  receivedCount: number
  promptTokens: number
  completionTokens: number
  totalTokens: number
  avgResponseMs: number
  lastResponseMs: number | null
  responses: number
  errorCount: number
}

interface SettingsPanelProps {
  settings: ChatSettings
  messageCount: number
  stats: ChatStats
  isBusy: boolean
  lastError: string | null
  onSettingsChange: (changes: Partial<ChatSettings>) => void
  onPlayStatusIndicator: () => void
}

export function SettingsPanel({
  settings,
  messageCount,
  stats,
  isBusy,
  lastError,
  onSettingsChange,
  onPlayStatusIndicator,
}: SettingsPanelProps) {
  return (
    <Card className="h-full border-slate-200 bg-white/80 py-0 backdrop-blur">
      <CardHeader className="px-5 pt-5">
        <CardTitle className="text-base font-semibold tracking-tight">
          Chat Settings
        </CardTitle>
        <CardDescription>
          Configure behavior for the AI chat preview.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5 px-5 pb-5">
        <div className="space-y-2">
          <Label htmlFor="model">Model</Label>
          <Select
            value={settings.model}
            onValueChange={(value) =>
              onSettingsChange({
                model: value as ChatSettings["model"],
              })
            }
          >
            <SelectTrigger id="model" className="w-full bg-white">
              <SelectValue placeholder="Select a model" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="deepseek/deepseek-r1-0528:free">
                deepseek/deepseek-r1-0528:free
              </SelectItem>
              <SelectItem value="openai/gpt-4.1-nano">
                openai/gpt-4.1-nano
              </SelectItem>
              <SelectItem value="openai/gpt-4.1-mini">
                openai/gpt-4.1-mini
              </SelectItem>
              <SelectItem value="openai/gpt-4.1">openai/gpt-4.1</SelectItem>
              <SelectItem value="openai/o4-mini">openai/o4-mini</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <Label htmlFor="temperature">Temperature</Label>
            <span className="text-xs text-muted-foreground">
              {settings.temperature.toFixed(1)}
            </span>
          </div>
          <Slider
            id="temperature"
            min={0}
            max={1}
            step={0.1}
            value={[settings.temperature]}
            onValueChange={([value]) =>
              onSettingsChange({ temperature: Number(value.toFixed(1)) })
            }
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <Label htmlFor="typing-speed">Typing speed</Label>
            <span className="text-xs text-muted-foreground">
              {settings.typingSpeed.toFixed(1)}s
            </span>
          </div>
          <Slider
            id="typing-speed"
            min={0.4}
            max={2.2}
            step={0.1}
            value={[settings.typingSpeed]}
            onValueChange={([value]) =>
              onSettingsChange({ typingSpeed: Number(value.toFixed(1)) })
            }
          />
        </div>

        <Separator />

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="use-openrouter">Use OpenRouter API</Label>
            <Switch
              id="use-openrouter"
              checked={settings.useOpenRouter}
              onCheckedChange={(checked) =>
                onSettingsChange({ useOpenRouter: checked })
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="auto-reply">Auto reply</Label>
            <Switch
              id="auto-reply"
              checked={settings.autoReply}
              onCheckedChange={(checked) => onSettingsChange({ autoReply: checked })}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="show-indicator">Show processing indicator</Label>
            <Switch
              id="show-indicator"
              checked={settings.showProcessingIndicator}
              onCheckedChange={(checked) =>
                onSettingsChange({ showProcessingIndicator: checked })
              }
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isBusy}
            onClick={onPlayStatusIndicator}
            className="w-full"
          >
            Play status indicator
          </Button>
          <div className="flex items-center justify-between">
            <Label htmlFor="concise-mode">Concise mode</Label>
            <Switch
              id="concise-mode"
              checked={settings.conciseMode}
              onCheckedChange={(checked) =>
                onSettingsChange({ conciseMode: checked })
              }
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="persona">Assistant persona</Label>
          <Textarea
            id="persona"
            value={settings.persona}
            onChange={(event) => onSettingsChange({ persona: event.target.value })}
            placeholder="e.g. Product strategist"
            className="min-h-20 bg-white"
          />
        </div>

        <p className="text-xs text-muted-foreground">
          Messages: {messageCount} total, sent{" "}
          <span className="font-medium">{stats.sentCount}</span>, received{" "}
          <span className="font-medium">{stats.receivedCount}</span>
        </p>
        <div className="space-y-1 text-xs text-muted-foreground">
          <p>
            Tokens used: <span className="font-medium">{stats.totalTokens.toLocaleString()}</span>
          </p>
          <p>
            Token split: prompt <span className="font-medium">{stats.promptTokens.toLocaleString()}</span>, completion{" "}
            <span className="font-medium">{stats.completionTokens.toLocaleString()}</span>
          </p>
          <p>
            Response time: avg <span className="font-medium">{Math.round(stats.avgResponseMs)}ms</span>, last{" "}
            <span className="font-medium">
              {stats.lastResponseMs === null ? "-" : `${Math.round(stats.lastResponseMs)}ms`}
            </span>
          </p>
          <p>
            Completed replies: <span className="font-medium">{stats.responses}</span>, errors{" "}
            <span className="font-medium">{stats.errorCount}</span>
          </p>
        </div>
        {lastError ? (
          <p className="rounded-md border border-destructive/20 bg-destructive/5 p-2 text-xs text-destructive">
            {lastError}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
