import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useGetPosts, getGetPostsQueryKey } from "@workspace/api-client-react";
import { PosterCard } from "@/components/poster-card";
import { Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { motion } from "framer-motion";

export default function Browse() {
  const searchParams = new URLSearchParams(window.location.search);
  const extId = searchParams.get("extId") ? Number(searchParams.get("extId")) : null;
  const filter = searchParams.get("filter") || "";
  const title = searchParams.get("title") || "Browse";

  const [page, setPage] = useState(1);
  const [allPosts, setAllPosts] = useState<any[]>([]);

  const { data, isLoading, isFetching } = useGetPosts(
    { extId: extId!, filter, page },
    { query: { enabled: !!extId, queryKey: getGetPostsQueryKey({ extId: extId!, filter, page }) } }
  );

  useEffect(() => {
    if (data?.posts) {
      setAllPosts(prev => {
        const newPosts = data.posts.filter((p: any) => !prev.some(existing => existing.link === p.link));
        return [...prev, ...newPosts];
      });
    }
  }, [data]);

  return (
    <div className="p-6 md:p-12 max-w-7xl mx-auto min-h-screen">
      <div className="mb-8 flex items-center gap-4">
        <Link href="/">
          <Button variant="ghost" size="icon" className="rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-4xl font-serif font-bold">{title}</h1>
        </div>
      </div>

      {allPosts.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6 mb-8">
          {allPosts.map((post, i) => (
            <motion.div
              key={`${post.link}-${i}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i % 20 * 0.05, 0.5) }}
            >
              <PosterCard 
                title={post.title} 
                poster={post.image} 
                link={post.link} 
              />
            </motion.div>
          ))}
        </div>
      )}

      {isLoading && allPosts.length === 0 && (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {data?.hasNextPage && (
        <div className="flex justify-center py-8">
          <Button 
            variant="outline" 
            size="lg" 
            onClick={() => setPage(p => p + 1)}
            disabled={isFetching}
            className="rounded-full px-8"
          >
            {isFetching ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
            Load More
          </Button>
        </div>
      )}
    </div>
  );
}
