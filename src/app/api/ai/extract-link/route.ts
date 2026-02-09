import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase/server';
import { extractFromUrl } from '@/lib/ai/anthropic';

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { url, item_type } = body;

    if (!url || !item_type) {
      return NextResponse.json(
        { error: 'url and item_type are required' },
        { status: 400 }
      );
    }

    // Validate item type
    const validTypes = ['accommodation', 'transport', 'cost', 'itinerary_day'];
    if (!validTypes.includes(item_type)) {
      return NextResponse.json(
        { error: `item_type must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Fetch the URL content
    let pageContent: string;
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; HolidayPlannerBot/1.0)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });

      if (!response.ok) {
        return NextResponse.json(
          { error: `Failed to fetch URL: ${response.status}` },
          { status: 400 }
        );
      }

      const html = await response.text();

      // Basic HTML to text conversion - strip tags and normalize whitespace
      pageContent = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 15000); // Limit content size
    } catch (fetchError) {
      return NextResponse.json(
        { error: 'Failed to fetch URL content' },
        { status: 400 }
      );
    }

    if (!pageContent || pageContent.length < 50) {
      return NextResponse.json(
        { error: 'Unable to extract meaningful content from URL' },
        { status: 400 }
      );
    }

    // Extract structured data using AI
    const extracted = await extractFromUrl(pageContent, item_type);

    return NextResponse.json({
      extracted,
      source_url: url,
    });
  } catch (error) {
    console.error('AI extract-link error:', error);
    return NextResponse.json(
      { error: 'Link extraction failed' },
      { status: 500 }
    );
  }
}
