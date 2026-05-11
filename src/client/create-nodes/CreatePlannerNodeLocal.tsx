import { Text, View } from 'react-native';
import { CreateCanvasShell } from '../create-ui/pages/create/CreateCanvasSharedNodes.js';

export function CreatePlannerNodeLocal(args: {
  prompt: string;
  canPlan: boolean;
  isPlanning: boolean;
  error?: string | null;
  onPromptChange: (prompt: string) => void;
  onGeneratePlan: () => void;
  onFocusArea?: () => void;
}) {
  const canGeneratePlan = args.canPlan && !args.isPlanning;
  return (
    <CreateCanvasShell title="Add pages" onFocusArea={args.onFocusArea}>
      <div className="relative">
        <textarea
          aria-label="Add pages prompt"
          className="min-h-[360px] w-full resize-none rounded-[24px] border-0 bg-white px-6 py-5 text-[18px] leading-7 text-black outline-none placeholder:text-black/32"
          style={{
            boxShadow: '0 18px 54px rgba(24, 20, 16, 0.10), inset 0 0 0 1px rgba(0, 0, 0, 0.08)',
            height: 360,
            minHeight: 360,
          }}
          placeholder="Generate pages for Research, About, Expertise, Insights, Publications, and Contact."
          value={args.prompt}
          onChange={(event) => args.onPromptChange(event.currentTarget.value)}
        />
      </div>
      <div className="mt-5 flex justify-end">
        <button
          type="button"
          aria-label="Add pages"
          className="min-h-[56px] min-w-[172px] rounded-full px-6 text-[16px] font-semibold text-white shadow-[0_16px_36px_rgba(24,20,16,0.10)] disabled:cursor-not-allowed"
          style={{ backgroundColor: canGeneratePlan ? '#000000' : 'rgba(0, 0, 0, 0.18)' }}
          disabled={!canGeneratePlan}
          onClick={args.onGeneratePlan}
        >
          {args.isPlanning ? 'Adding pages' : 'Add pages'}
        </button>
      </div>
      {args.error ? (
        <View className="mt-4 rounded-[18px] border border-[#efc7be] bg-[#fff1ee] px-4 py-3">
          <Text className="text-sm text-[#7b2727]">{args.error}</Text>
        </View>
      ) : null}
    </CreateCanvasShell>
  );
}
