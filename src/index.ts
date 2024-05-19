import { commands, CompleteResult, ExtensionContext, listManager, sources, window, workspace } from 'coc.nvim';
import DemoList from './lists';

export async function activate(context: ExtensionContext): Promise<void> {
  window.showInformationMessage('coc-oxc works!');

  context.subscriptions.push(
    commands.registerCommand('coc-oxc.Command', async () => {
      window.showInformationMessage('coc-oxc Commands works!');
    }),

    listManager.registerList(new DemoList()),

    sources.createSource({
      name: 'coc-oxc completion source', // unique id
      doComplete: async () => {
        const items = await getCompletionItems();
        return items;
      },
    }),

    workspace.registerKeymap(
      ['n'],
      'oxc-keymap',
      async () => {
        window.showInformationMessage('registerKeymap');
      },
      { sync: false }
    ),

    workspace.registerAutocmd({
      event: 'InsertLeave',
      request: true,
      callback: () => {
        window.showInformationMessage('registerAutocmd on InsertLeave');
      },
    })
  );
}

async function getCompletionItems(): Promise<CompleteResult> {
  return {
    items: [
      {
        word: 'TestCompletionItem 1',
        menu: '[coc-oxc]',
      },
      {
        word: 'TestCompletionItem 2',
        menu: '[coc-oxc]',
      },
    ],
  };
}
